const ipc = require("@achrinza/node-ipc").default;
const cp = require("child_process");
const process = require("process");
const colors = require("@colors/colors");
const readline = require("readline");
let waitMessage = 5;
let skipWaitCommand=["tellraw"]
class CommanderTask {
  constructor(command, resolve, reject) {
    this.Command = command;
    this._resolve = resolve;
    this._reject = reject;
    this.buffer = [];
  }
  get resolve() {
    return this._resolve;
  }
  get reject() {
    return this._reject;
  }
}
const GameManager = {
  status: "waitPath",
  startCommand: "",
  MinecraftProcess: null,
  readLine: null,
  CommandQueue: [],
  CurrCommand: null,
  async requestCommand(command) {
    return new Promise((resolve, reject) => {
      this.CommandQueue.push(new CommanderTask(command, resolve, reject));
      this.tryRunNextCommand();
    });
  },
  tryRunNextCommand() {
    if (this.status == "running" && !this.CurrCommand && this.CommandQueue.length) {
      this.RunNextCommand();
    }
  },
  FinishCommand() {
    this.CurrCommand.resolve(this.CurrCommand.buffer.join("\n"));
    return this.RunNextCommand();
  },
  RunNextCommand() {
    if (!this.CommandQueue.length) {
      this.CurrCommand = null;
      return;
    }
    this.CurrCommand = this.CommandQueue.shift();
    this.CurrCommand.timer = 0;
    console.log(colors.rainbow(`执行命令:` + this.CurrCommand.Command));
    this.MinecraftProcess.stdin.write(this.CurrCommand.Command + "\n");
    const NowCommand=this.CurrCommand.Command.split(" ")[0];
    if(skipWaitCommand.find(NowCommand)) {
      return this.FinishCommand();
    }
    this.CurrCommand.timer = setTimeout(() => {
      return this.FinishCommand();
    }, 50);
  },
  Init() {
    ipc.config.slient=true;
    ipc.serve("/tmp/MinecraftManager.service");
    ipc.server.start();
    ipc.server.on("status", () => {
      ipc.server.broadcast("status", this.status);
    });
    ipc.server.on("startServer", () => {
      this.Start();
    });
    ipc.server.on("path", p => {
      this.startCommand = p;
      this.status = "stop";
    });
    process.on("exit", code => {
      if (this.MinecraftProcess && this.MinecraftProcess.kill) {
        this.MinecraftProcess.kill();
      }
    });
    ipc.server.on("command", ({ command, id }) => {
      this.CommandProcessor(command, id);
    });
  },
  async CommandProcessor(command, id) {
    console.log(command, id);
    let Launcher = this.requestCommand(command);
    Launcher.then(result => {
      ipc.server.broadcast("commandResult", { id, result });
    });
  },
  Start() {
    this.MinecraftProcess = cp.spawn(this.startCommand, { stdio: ["pipe", "pipe", "ignore"] });
    this.readLine = readline.createInterface({
      input: this.MinecraftProcess.stdout
    });
    this.status = "waitForReady";
    this.MinecraftProcess.on("exit", a => {
      this.CurrCommand = null;
      this.CommandQueue = [];
      console.log(`Minecraft Stopped`);
      this.readLine.close();
      this.Stop();
    });
    this.readLine.on("line", data => {
      this.MinecraftStdoutProcess(data);
    });
  },
  Stop() {
    this.status = "stop";
    ipc.server.broadcast("stop");
  },
  Ready() {
    this.status = "running";
    ipc.server.broadcast("ready");
  },
  MinecraftStdoutProcess(message) {
    if (/Done \(\d*\.\d*s\)!/.test(message)) {
      this.Ready();
    }
    if (
      this.CurrCommand &&
      /\[.*DedicatedServer\]: (.*)$/.test(message) &&
      !/DedicatedServer\]\: <.*?>.*/.test(message)
    ) {
      if (this.CurrCommand.timer) clearTimeout(this.CurrCommand.timer);
      let match = /\[.*DedicatedServer\]:(.*)$/.exec(message);

      if (match[1]) {
        console.log(colors.rainbow(`将命令:${this.CurrCommand.Command} 的输出储存为:${match[1]}`));
        this.CurrCommand.buffer.push(match[1]);
        this.CurrCommand.timer = setTimeout(() => {
          return this.FinishCommand();
        }, waitMessage);
      } else {
        console.log(colors.red(message));
      }
    }
    console.log(message);
  }
};
GameManager.Init();
