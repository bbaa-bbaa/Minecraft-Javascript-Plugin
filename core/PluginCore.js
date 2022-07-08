const Rcon = require("rcon-client").Rcon;
const fs = require("fs-extra");
const cp = require("child_process");
const moment = require("moment");
const ipc = require("@achrinza/node-ipc").default;
const EventEmitter = require("events");
const LogFileReader = require(__dirname + "/LogFileReader");
const CommandSender = require(__dirname + "/CommandSender")
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
    this.PluginInterfaces = new Map();
    this.Crashed = false;
    this.Error = false;
    this.ipc = ipc;
    this.initIpc(options);
    this.addPluginRegister(this.registerNativeLogProcesser, this);
    this.addPluginRegister(this.addPluginRegister, this);
    this.loadBuiltinPlugins();
    this.EventBus.on("disconnected", () => {
      this.Disconnected();
    });
    this.EventBus.on("connected", this.Connected.bind(this));
    this.CommandSender = new CommandSender(this, this.ipc.of.GM);
  }
  loadBuiltinPlugins() {
    this.registerPlugin(require(__dirname + "/plugins/simpleCommand.js"));
    this.registerPlugin(require(__dirname + "/plugins/players.js"));
    this.registerPlugin(require(__dirname + "/plugins/scoreboard.js"));
    this.registerPlugin(require(__dirname + "/plugins/WorldMapping.js"));
    this.registerPlugin(require(__dirname + "/plugins/Teleport.js"));
  }
  registerPlugin(Constructor) {
    let PluginClass = Constructor;
    if (this.PluginInterfaces.has(PluginClass.name)) {
      return console.log(`${PluginClass.PluginName} 已经加载，跳过本次加载`);
    }
    let PluginInterface = new PluginClass(this);
    this.PluginInterfaces.set(PluginClass.name, PluginInterface);
    PluginInterface._state = "Paused";
    PluginInterface.init(this.genRegisterHelper(PluginInterface));
    console.log(`[PluginsCore]${PluginClass.PluginName} 加载完成`);
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
    console.log(`[PluginsCore]${scope.constructor.PluginName} 注册了一个原始日志处理器 ${func.name || `(anonymous)`} match:(regex)${regexp}`);
    this.NativeLogProcessers.push({ regexp: regexp, func: func, scope: scope });
  }
  initIpc(options) {
    this.ipc.config.silent=true;
    this.ipc.connectTo("GM", "/tmp/MinecraftManager.service");
    this.ipc.of.GM.on("connect", () => {
      console.log(`[PluginsCore:IPC]IPC连接成功`)
      this.ipc.of.GM.emit("state")
    })
    this.ipc.of.GM.on("disconnect", () => {
      console.log(`[PluginsCore:IPC]IPC连接断开`)
      this.EventBus.emit("disconnected");
    })
    this.ipc.of.GM.on("stop", () => {
      this.EventBus.emit("disconnected");
      console.log(`[PluginsCore:GameManager]服务器停止`)
    })
    this.ipc.of.GM.on("ready", () => {
      this.EventBus.emit("connected");
    })
    this.ipc.of.GM.on("state", (s) => {
      switch (s) {
        case "waitPath":
          console.log(`[PluginsCore:IPC]发送启动命令`)
          this.ipc.of.GM.emit("path", this.BaseDir + "/start");
          this.ipc.of.GM.emit("state")
          break;
        case "stop":
          console.log(`[PluginsCore:IPC]启动服务器`)
          this.ipc.of.GM.emit("startServer");
          break;
        case "running":
          this.EventBus.emit("connected");
          break;
      }
    })
  }
  connectRconClient(options) {
    return Rcon.connect(options.Rcon)
      .then(Rcon => {
        this.RconClient = Rcon;
        this.RconClient.on("error", this.ErrorHandle.bind(this));
        this.EventBus.emit("connected");
      })
      .catch((e) => {
        this.Error = false;
        this.ErrorHandle(e);
      });
  }
  reconnectRcon(name) {
    this.EventBus.emit("disconnected");
    console.log(`[${name}]请求重连Rcon`);
    setTimeout(() => {
      console.log("[PluginsCore:Rcon]正在重连");
      this.connectRconClient(this.options);
    }, 10000);
  }
  Connected() {
    setTimeout(() => {
      this.LogFileReader = new LogFileReader(this, this.LogFile);
    }, 1000);
    for (let Plugin of this.PluginInterfaces.values()) {
      if (Plugin._state == "Started") continue;
      if (Plugin.Start) {
        Plugin.Start.call(Plugin);
      }
      Plugin._state = "Started";
    }
    console.log("[PluginsCore:Rcon]Rcon Connected");
    this.Error = false;
  }
  Disconnected() {
    for (let Plugin of this.PluginInterfaces.values()) {
      if (Plugin._state == "Paused") continue;
      if (Plugin.Pause) {
        Plugin.Pause.call(Plugin);
      }
      Plugin._state = "Paused";
    }
    if (this.LogFileReader.close) {
      this.LogFileReader.close();
    }
    if (this.CommandSender && this.CommandSender.cancelAll) {
      this.CommandSender.cancelAll();
    }
  }
  async ErrorHandle(a) {
    console.error(a);
    return;
  }
  ProcessLog(line) {
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
