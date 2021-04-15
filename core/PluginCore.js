const Rcon = require("rcon-client").Rcon;
const fs = require("fs-extra");
const cp = require("child_process");
const moment = require("moment");
const EventEmitter = require("events");
const LogFileReader = require(__dirname + "/LogFileReader");
class PluginCore {
  constructor(options) {
    console.log(`Plugins Core 启动`);
    this.RconClient = {};
    this.EventBus = new EventEmitter();
    this.LogFileReader = new LogFileReader(this);
    this.LogFile = options.log;
    this.options = options;
    this.PluginRegisters = [];
    this.NativeLogProcessers = [];
    this.PluginInterfaces = {};
    this.connectRconClient(options);
    this.addPluginRegister(this.registerNativeLogProcesser, this);
    this.addPluginRegister(this.addPluginRegister, this);
    this.loadBuiltinPlugins();
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
    this.EventBus.on("connected", this.Connected.bind(this));
    return Rcon.connect(options.Rcon).then(Rcon => {
      this.RconClient = Rcon;
      this.RconClient.on("error", this.ErrorHandle.bind(this));
      this.EventBus.emit("connected");
    }).catch(()=>{this.ErrorHandle()});
  }
  Connected() {
    this.WatchFile();
    for (let Plugin of Object.values(this.PluginInterfaces)) {
      if (Plugin.Start) {
        Plugin.Start.call(Plugin);
      }
    }
    console.log("Rcon Connected");
  }
  async WatchFile() {
    this.LogFileReader.Handle = await fs.promises.open(this.LogFile, "r");
    this.LogFileReader.Pos = (await fs.promises.stat(this.LogFile)).size;
    fs.watchFile(this.LogFile, { interval: 100 }, this.LogFileReader.readPartFile.bind(this.LogFileReader));
  }
  ErrorHandle() {
    if (this.RconClient.socket && this.RconClient.socket.destoryed||!this.RconClient.socket) {
      this.EventBus.emit("disconnected");
      for (let Plugin of Object.values(this.PluginInterfaces)) {
        if (Plugin.Pause) {
          Plugin.Pause.call(Plugin);
        }
      }
      console.log("发生错误10s后重新链接");
      fs.unwatchFile(this.LogFile);
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
          console.error(e)
        }
      }
    }
  }
}
module.exports = PluginCore;
