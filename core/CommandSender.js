let delay = 0;
const enableQuene = true;
const process = require("process");
class CommanderTask {
  constructor(command, id, resolve, reject, strict) {
    this.command = command;
    this.id = id;
    this._resolve = resolve;
    this._reject = reject;
    this.promise = new Promise((r, j) => {
      this._internalResolve = r;
      this._internalReject = j;
    });
    this.strict = strict;
  }
  id = 0;
  resolve(r) {
    this._resolve(r);
    return this._internalResolve(r);
  }
  reject(j) {
    this._reject(j);
    return this._internalReject(j);
  }
}
class CommandSender {
  constructor(Core, ipc) {
    this.Core = Core;
    this.ipc = ipc;
    this.ipc.on("commandResult", this.resolveCommand.bind(this));
  }
  CommandMapping = new Map();
  CommandIndex = 0;
  paused = true;
  TimerId = -1;
  lastRun = -1;
  resolveCommand({ id, result }) {
    if (this.CommandMapping.has(id)) {
      let curr = this.CommandMapping.get(id);
      this.CommandMapping.delete(id);
      //console.log(`[CommandSender]命令[${curr.id}]：${curr.Command} 结果:${result}`)
      curr.resolve(result);
    }
  }
  async requestCommand(command, strict = false) {
    return new Promise((resolve, reject) => {
      const Task = new CommanderTask(command, this.CommandIndex++, resolve, reject, strict);
      this.Queue.push(Task);
      this.tryRunNext();
    });
  }
  tryRunNext() {
    if (new Date().getTime() - this.lastRun > delay) {
      if (this.Queue.length && this.paused) this.runNext();
    } else if (this.Queue.length && this.paused) {
      console.log(`[CommandSender]正在延迟执行捏:${delay - (new Date().getTime() - this.lastRun)} ms`);
      this.paused = false;
      this.TimerId = setTimeout(this.runNext.bind(this), delay - (new Date().getTime() - this.lastRun));
    }
  }
  cancelAll() {
    let item;
    while ((item = this.Queue.shift())) {
      item.reject();
    }
    if (this.TimerId >= 0) clearTimeout(this.TimerId);
  }
  runNext() {
    this.lastRun = new Date().getTime();
    this.paused = false;
    let curr = this.Queue.shift();

    this.CommandMapping.set(process.pid + "_" + curr.id, curr);
    console.log(`[CommandSender]正在执行[${curr.id}]：${curr.command} 队列中剩余:${this.Queue.length}`);
    curr.promise
      .catch(e => {
        curr.reject(e);
        return this.Core.ErrorHandle.call(this.Core, e);
      })
      .finally(() => {
        if (!enableQuene) return;
        if (this.Queue.length) {
          if (delay) {
            console.log(`[CommandSender]正在延迟执行捏:${delay} ms`);
            this.TimerId = setTimeout(this.runNext.bind(this), delay);
          } else {
            return this.runNext();
          }
        } else {
          this.paused = true;
        }
      });
    this.ipc.emit("command", { command: curr.command, id: process.pid + "_" + curr.id });
    if (!enableQuene) {
      if (this.Queue.length) {
        return this.runNext();
      } else {
        this.paused = true;
      }
    }
  }
  Queue = [];
}
module.exports = CommandSender;
