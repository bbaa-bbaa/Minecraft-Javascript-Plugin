const ipc = require("@achrinza/node-ipc").default;
const cp = require("child_process");
const process = require("process");
const colors = require("@colors/colors");
const readline = require("readline");
const path = require("path");
const _ = require("lodash");
const iconv = require("iconv-lite");
let waitMessage = 15;
const skipWaitCommand = ["tellraw"];
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
  state: "waitPath",
  startCommand: "",
  MinecraftProcess: null,
  readLine: null,
  CommandQueue: [],
  _ReadyWaitId: 0,
  CurrCommand: null,
  async requestCommand(command) {
    command = command.replace(/\n/g, "");
    return new Promise((resolve, reject) => {
      this.CommandQueue.push(new CommanderTask(command, resolve, reject));
      this.tryRunNextCommand();
    });
  },
  tryRunNextCommand() {
    if (this.state == "running" && !this.CurrCommand && this.CommandQueue.length) {
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
    console.log(colors.green(`[MinecraftManager]执行命令:`) + colors.red(this.CurrCommand.Command));
    if (process.platform == "win32") {
      this.MinecraftProcess.stdin.write(iconv.encode(this.CurrCommand.Command + "\r\n", "GBK"));
    } else {
      this.MinecraftProcess.stdin.write(this.CurrCommand.Command + "\n");
    }
    const NowCommand = this.CurrCommand.Command.split(" ")[0];
    // 无返回命令处理
    if (skipWaitCommand.indexOf(NowCommand) >= 0) {
      return this.FinishCommand();
    }
    this.CurrCommand.timer = setTimeout(() => {
      return this.FinishCommand();
    }, 1000);
  },
  Init() {
    ipc.config.silent = true;
    ipc.config.id = "MinecraftManager";
    ipc.serve();
    ipc.server.start();
    ipc.server.on("state", () => {
      ipc.server.broadcast("state", this.state);
    });
    ipc.server.on("startServer", () => {
      console.log(colors.green(`[MinecraftManager]正在请求启动服务器`));
      this.Start();
    });
    ipc.server.on("path", p => {
      console.log(colors.green(`[MinecraftManager]接收到启动命令路径：` + p));
      this.startCommand = p;
      this.state = "stop";
    });
    process.on("exit", async code => {
      if (this.MinecraftProcess && this.MinecraftProcess.kill) {
        // console.log(colors.green(`[MinecraftManager]等待服务器关闭`));
        this.MinecraftProcess.kill();
      }
    });
    process.on("SIGINT", async code => {
      if (this.MinecraftProcess && this.MinecraftProcess.kill) {
        console.log(colors.green(`[MinecraftManager]等待服务器关闭`));
        this.MinecraftProcess.kill();
        while (this.state != "stop") {
          console.log(colors.green(`[MinecraftManager]等待服务器关闭`));
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      process.exit();
    });
    process.on("SIGTERM", async code => {
      if (this.MinecraftProcess && this.MinecraftProcess.kill) {
        console.log(colors.green(`[MinecraftManager]等待服务器关闭`));
        this.MinecraftProcess.kill();
        while (this.state != "stop") {
          console.log(colors.green(`[MinecraftManager]等待服务器关闭`));
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      process.exit();
    });
    ipc.server.on("command", ({ command, id }) => {
      this.CommandProcessor(command, id);
    });
    console.log(colors.green(`[MinecraftManager]初始化完成，等待连接`));
  },
  async CommandProcessor(command, id) {
    let Launcher = this.requestCommand(command);
    Launcher.then(result => {
      ipc.server.broadcast("commandResult", { id, result });
    });
  },
  Start() {
    this.MinecraftProcess = cp.spawn(this.startCommand, { stdio: ["pipe", "pipe", "ignore"], shell: true, cwd: path.dirname(this.startCommand) });
    if (process.platform == "win32") {
      let iconvStream = iconv.decodeStream('GBK');
      this.MinecraftProcess.stdout.pipe(iconvStream)
      this.readLine = readline.createInterface({
        input: iconvStream
      });
    } else {
      this.readLine = readline.createInterface({
        input: this.MinecraftProcess.stdout
      });
    }
    this.state = "waitForReady";
    this.MinecraftProcess.on("exit", a => {
      this.CurrCommand = null;
      this.CommandQueue = [];
      console.log(`[MinecraftManager]Minecraft Stopped`);
      this.readLine.close();
      this.Stop();
    });
    this.readLine.on("line", data => {
      this.MinecraftStdoutProcess(data);
    });
  },
  Stop() {
    this.state = "stop";
    if (this._ReadyWaitId) {
      clearTimeout(this._ReadyWaitId);
    }
    ipc.server.broadcast("stop");
  },
  beforeReady() {
    this.state = "beforeReady";
    console.log(colors.green(`[MinecraftManager]服务器启动完成，等待REPL初始化完成`));
    this.MinecraftProcess.stdin.write("testReady" + "\n");
  },
  Ready() {
    this.state = "running";
    console.log(colors.green(`[MinecraftManager]REPL初始化完成，等待插件模块发送信息`));
    console.log(colors.green(`[MinecraftManager]延迟5s通知插件模块，等待服务稳定后在接收命令请求`));
    this._ReadyWaitId = setTimeout(() => {
      console.log(colors.green(`[MinecraftManager]通知插件模块Minecraft Manager已准备好`));
      ipc.server.broadcast("ready");
    }, 5000);
  },
  MinecraftStdoutProcess(message) {
    if (this.state !== "running") {
      if (this.state == "waitForReady" && /Done \(\d*\.\d*s\)!/.test(message)) {
        this.beforeReady();
      } else if (
        this.state == "beforeReady" &&
        /(Unknown command.|Unknown or incomplete command)/.test(message)
      ) {
        this.Ready();
      } else {
        console.log(message);
      }
      return;
    }

    if (this.CurrCommand || message.length < 200) {
      let [DedicatedServerMessage, PlayerMessage, GameLeftMessage, LoginMessage] = [
        /\[.*\]: (.*)$/.test(message),
        /\]\: <.*?>.*/.test(message),
        /\w+ (left|joined) the game/.test(message),
        /\[.*\]:.*? logged in with/.test(message)
      ];
      if (this.CurrCommand && DedicatedServerMessage && !PlayerMessage && !GameLeftMessage && !LoginMessage) {
        if (this.CurrCommand.timer) clearTimeout(this.CurrCommand.timer);
        let match = /\[.*?\]: (.*)$/.exec(message);

        if (match[1]) {
          console.log(
            colors.green(`[MinecraftManager]将命令:`) +
            colors.blue(this.CurrCommand.Command) +
            colors.green(`的输出储存为:`) +
            colors.yellow(match[1])
          );
          this.CurrCommand.buffer.push(match[1].trim());
          this.CurrCommand.timer = setTimeout(() => {
            return this.FinishCommand();
          }, waitMessage);
        } else {
          console.log(`[MinecraftManager]未知输出:` + colors.red(message));
        }
      } else {
        ipc.server.broadcast("MinecraftLog", message);
      }
    }
  }
};
GameManager.Init();
