const Rcon = require("rcon-client").Rcon;
const fs = require("fs-extra");
const cp = require("child_process");
const process = require("process");
const ipc = require("@achrinza/node-ipc").default;
const EventEmitter = require("events");
const LogFileReader = require(__dirname + "/LogFileReader");
const MinecraftLogReceivcer = require(__dirname + "/GameManagerLogReceiver");
const CommandSender = require(__dirname + "/CommandSender");
const util = require("util");
const colors = require("@colors/colors");
const runCommand = util.promisify(cp.exec);
class PluginCore {
  constructor(options) {
    console.log(colors.red(`Plugins Core 启动`));
    //this.RconClient = {};

    this.platform = process.platform;
    this.isForge = options.isForge;
    this.EventBus = new EventEmitter();

    //this.LogFileReader = {};
    //this.MinecraftLogReceivcer = null;
    //this.LogFile = options.BaseDir + "/logs/latest.log";
    
    this.BaseDir = options.BaseDir;
    this.options = options;
    this.startCommand = options.startCommand || this.BaseDir + "/start";
    this.PendingRestart = false;
    
    this.Crashed = false;
    this.Error = false;
    this.ipc = ipc;
    this.ipcState = "waitPath";
    this.crashDetect();
    this.Crashed = false;
    this.initIpc(options);

    this.PluginSettings = options.PluginSettings || {}
    this.PluginRegisters = [];
    this.NativeLogProcessers = [];
    this.PluginInterfaces = new Map();
    this.addPluginRegister(this.registerNativeLogProcesser, this);
    this.addPluginRegister(this.addPluginRegister, this);
    this.loadBuiltinPlugins();
    this.EventBus.on("disconnected", () => {
      this.Disconnected();
    });
    this.EventBus.on("ready", this.Ready.bind(this));
    this.CommandSender = new CommandSender(this, this.ipc.of["MinecraftManager"]);
  }
  crashDetect() {
    fs.ensureDir(this.BaseDir + "/crash-reports/").then(() => {
      fs.watch(this.BaseDir + "/crash-reports/", {}, (e, f) => {
        this.Crashed = true;
      });
    });
  }
  loadBuiltinPlugins() {
    this.registerPlugin(require(__dirname + "/plugins/simpleCommand.js"));
    this.registerPlugin(require(__dirname + "/plugins/players.js"));
    this.registerPlugin(require(__dirname + "/plugins/scoreboard.js"));
    this.registerPlugin(require(__dirname + "/plugins/WorldMapping.js"));
    this.registerPlugin(require(__dirname + "/plugins/death.js"));
    this.registerPlugin(require(__dirname + "/plugins/back.js"));
    this.registerPlugin(require(__dirname + "/plugins/Teleport.js"));
  }
  registerPlugin(Constructor) {
    let PluginClass = Constructor;
    if (this.PluginInterfaces.has(PluginClass.name)) {
      return console.log(
        `${colors.yellow("[")}${colors.green("PluginsCore")}${colors.yellow("]")}${colors.magenta(
          PluginClass.PluginName
        )}  ${colors.yellow("已经加载，跳过本次加载")}`
      );
    }
    let PluginInterface = new PluginClass(this);
    let InitState = PluginInterface.init(this.genRegisterHelper(PluginInterface));
    if (InitState < 0) {
      console.log(
        `${colors.yellow("[")}${colors.green("PluginsCore")}${colors.yellow("]")}${colors.magenta(
          PluginClass.PluginName
        )} ${colors.red("加载失败 Reason: " + InitState)}`
      );
      return;
    }
    this.PluginInterfaces.set(PluginClass.name, PluginInterface);
    PluginInterface._state = "Paused";
    console.log(
      `${colors.yellow("[")}${colors.green("PluginsCore")}${colors.yellow("]")}${colors.magenta(
        PluginClass.PluginName
      )} ${colors.yellow("加载完成")}`
    );
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
    console.log(
      `${colors.yellow("[")}${colors.green("PluginsCore")}${colors.yellow("]")}${colors.magenta(
        scope.constructor.PluginName
      )} ${colors.yellow("注册了一个原始日志处理器")} ${colors.magenta(func.name || `(anonymous)`)} ${colors.yellow("match:") + colors.magenta("(regex)")
      }${colors.magenta(regexp.toString())}`
    );
    this.NativeLogProcessers.push({ regexp: regexp, func: func, scope: scope });
  }
  initIpc(options) {
    this.ipc.config.silent = true;
    this.ipc.connectTo("MinecraftManager");
    this.ipc.of["MinecraftManager"].on("connect", () => {
      console.log(
        `${colors.yellow("[")}${colors.green("PluginsCore:IPC")}${colors.yellow("]")}${colors.red("IPC连接成功")}`
      );
      this.ipc.of["MinecraftManager"].emit("state");
    });
    this.ipc.of["MinecraftManager"].on("disconnect", () => {
      this.ipcState = "disconnect";
      console.log(
        `${colors.yellow("[")}${colors.green("PluginsCore:IPC")}${colors.yellow("]")}${colors.red("IPC连接断开")}`
      );
      this.EventBus.emit("disconnected");
    });
    this.ipc.of["MinecraftManager"].on("stop", () => {
      this.EventBus.emit("disconnected");
      this.ipcState = "stop";
      console.log(
        `${colors.yellow("[")}${colors.green("PluginsCore:GameManager")}${colors.yellow("]")}${colors.red(
          "服务器停止"
        )}`
      );
      if (this.Crashed || this.PendingRestart) {
        this.Crashed = false;
        this.PendingRestart = false;
        this.ipc.of["MinecraftManager"].emit("state");
      }
    });
    this.ipc.of["MinecraftManager"].on("ready", () => {
      this.ipcState = "running";
      this.EventBus.emit("ready");
    });
    this.ipc.of["MinecraftManager"].on("state", s => {
      this.ipcState = s;
      switch (s) {
        case "waitPath":
          console.log(
            `${colors.yellow("[")}${colors.green("PluginsCore:IPC")}${colors.yellow("]")}${colors.yellow(
              "发送启动命令"
            )}`
          );
          if(!this.options.newVersion) {
            this.ipc.of["MinecraftManager"].emit("regex",{
              name:"DedicatedServerMessage",
              regex:"\\[.*\\]: (.*)$"
            });
          }
          this.ipc.of["MinecraftManager"].emit("path", this.startCommand);
          this.ipc.of["MinecraftManager"].emit("path", this.startCommand);
          this.ipc.of["MinecraftManager"].emit("state");
          break;
        case "stop":
          if (this.PendingRestart) {
            this.PendingRestart = false;
          }
          console.log(
            `${colors.yellow("[")}${colors.green("PluginsCore:IPC")}${colors.yellow("]")}${colors.green("启动服务器")}`
          );
          this.ipc.of["MinecraftManager"].emit("startServer");
          break;
        case "running":
          this.EventBus.emit("ready");
          break;
      }
    });
  }
  /*
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
  }*/
  Ready() {
    /*
    setTimeout(() => {
      this.LogFileReader = new LogFileReader(this, this.LogFile);
    }, 1000);
    */
    if (!this.MinecraftLogReceivcer)
      setTimeout(() => {
        this.MinecraftLogReceivcer = new MinecraftLogReceivcer(this, this.ipc.of["MinecraftManager"]);
      }, 1000);
    for (let Plugin of this.PluginInterfaces.values()) {
      if (Plugin._state == "Started") continue;
      if (Plugin.Start) {
        console.log(
          `${colors.yellow("[")}${colors.green("PluginsCore")}${colors.yellow("]请求初始化")} ${colors.magenta(
            Plugin.constructor.PluginName
          )}`
        );
        Plugin.Start.call(Plugin);
      }
      Plugin._state = "Started";
    }
    console.log(`${colors.yellow("[")}${colors.green("PluginsCore:GameManager")}${colors.yellow("]Game Ready")}`);
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
/*
    if (this.LogFileReader.close) {
      this.LogFileReader.close();
    }
*/
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
