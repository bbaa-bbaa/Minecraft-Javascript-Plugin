const Rcon = require("rcon-client").Rcon;
const fs = require("fs-extra");
const cp = require("child_process");
const moment = require("moment");
const EventEmitter = require("events");
const LogFileReader = require(__dirname + "/LogFileReader");
const util = require("util");
const runCommand = util.promisify(cp.exec);
class PluginCore {
  constructor(options) {
    console.log(`Plugins Core 启动`);
    this.RconClient = {};
    this.EventBus = new EventEmitter();
    this.LogFileReader = {};
    this.LogFile = options.BaseDir + "/logs/latest.log";
    this.BaseDir = options.BaseDir;
    this.options = options;
    this.PluginRegisters = [];
    this.NativeLogProcessers = [];
    this.PluginInterfaces = {};
    this.Crashed=false;
    this.Error=false;
    this.connectRconClient(options);
    this.addPluginRegister(this.registerNativeLogProcesser, this);
    this.addPluginRegister(this.addPluginRegister, this);
    this.loadBuiltinPlugins();
    this.crashDetect()
    this.EventBus.on("disconnected", () => {
      this.Disconnected();
    });
    this.EventBus.on("connected", this.Connected.bind(this));
  }
  crashDetect(){
    fs.watch(this.BaseDir+"/crash-reports/",{},(e,f)=>{
      this.Crashed=true;
    })
  }
  loadBuiltinPlugins() {
    this.registerPlugin(require(__dirname + "/plugins/simpleCommand.js"));
    this.registerPlugin(require(__dirname + "/plugins/players.js"));
    this.registerPlugin(require(__dirname + "/plugins/scoreboard.js"));
  }
  registerPlugin(Constructor) {
    let PluginClass = Constructor;
    if (this.PluginInterfaces[PluginClass.name]) {
      return console.log(`${PluginClass.PluginName} already loaded skipping`);
    }
    let PluginInterface = new PluginClass(this);
    this.PluginInterfaces[PluginClass.name] = PluginInterface;
    PluginInterface.init(this.genRegisterHelper(PluginInterface));
    console.log(`${PluginClass.PluginName} loaded finish`);
  }
  addPluginRegister(func, scope) {
    this.PluginRegisters.push({ func: func.bind(scope), scope: scope, name: func.name });
  }
  genRegisterHelper(PluginScope) {
    let Root = {};
    for (let funcP of this.PluginRegisters) {
      Root[funcP.name] = (...arr) => {
        return funcP.func(...arr, PluginScope);
      };
    }
    return Root;
  }
  registerNativeLogProcesser(regexp, func, scope) {
    console.log(`${scope.constructor.PluginName} register a Native Log Processor ${func.name} match:(regex)${regexp}`);
    this.NativeLogProcessers.push({ regexp: regexp, func: func, scope: scope });
  }
  connectRconClient(options) {
    return Rcon.connect(options.Rcon)
      .then(Rcon => {
        this.RconClient = Rcon;
        this.RconClient.on("error", this.ErrorHandle.bind(this));
        this.EventBus.emit("connected");
      })
      .catch(() => {
        this.ErrorHandle();
      });
  }
  Connected() {
    setTimeout(()=>{
    this.LogFileReader = new LogFileReader(this, this.LogFile);
    },1000);
    for (let Plugin of Object.values(this.PluginInterfaces)) {
      if (Plugin.Start) {
        Plugin.Start.call(Plugin);
      }
    }
    console.log("Rcon Connected");
    this.Error=false;
  }
  Disconnected() {
    for (let Plugin of Object.values(this.PluginInterfaces)) {
      if (Plugin.Pause) {
        Plugin.Pause.call(Plugin);
      }
    }
    if (this.LogFileReader.close) {
      this.LogFileReader.close();
    }
  }
  async ErrorHandle(a) {
    console.error(a);
    if (((this.RconClient.socket && this.RconClient.socket.destoryed) || !this.RconClient.socket)&&!this.Error) {
      this.Error=true;
      this.EventBus.emit("disconnected");
      console.log("发生错误10s后重新链接");
      if(this.Crashed){
        this.Crashed=false;
        await runCommand(`${this.Core.BaseDir}/runserver`)
      }
      setTimeout(() => {
        this.connectRconClient(this.options).catch(() => {
          this.ErrorHandle();
        });
      }, 10000);
    }
  }
  ProcessLog(line) {
    //console.log(line)
    for (let Processr of this.NativeLogProcessers) {
      if (Processr.regexp.test(line)) {
        try {
          Processr.func.call(Processr.scope, line);
        } catch (e) {
          console.error(e);
        }
      }
    }
  }
}
module.exports = PluginCore;
