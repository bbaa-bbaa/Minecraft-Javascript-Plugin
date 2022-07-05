let delay = 100;
class CommanderTask {
  constructor(command, resolve, reject, strict) {
    this.Command = command;
    this._resolve = resolve;
    this._reject = reject;
    this.strict = strict;
  }
  get resolve() {
    return this._resolve;
  }
  get reject() {
    return this._reject;
  }
}
class CommandSender {
  constructor(Core, Rcon) {
    this.Core = Core;
    this.Rcon = Rcon;
  }
  paused = true;
  TimerId = -1;
  lastRun = -1;
  async requestCommand(command, strict = false) {
    return new Promise((resolve, reject) => {
      this.Queue.push(new CommanderTask(command, resolve, reject, strict));
      this.tryRunNext();
    });
  }
  tryRunNext() {
    if (new Date().getTime() - this.lastRun > delay) {
      if (this.Queue.length && this.paused) this.runNext();
    } else if (this.Queue.length && this.paused) {
      console.log(`正在延迟执行捏:${delay - (new Date().getTime() - this.lastRun)} ms`)
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
    console.log(`[${new Date().getTime()}]正在执行：${curr.Command} 队列中剩余:${this.Queue.length}`);
    return this.Core.RconClient.send(curr.Command)
      .then(a => {
        curr.resolve(a);
      })
      .catch(e => {
        curr.reject(e);
        return this.Core.ErrorHandle.call(this.Core, e);
      })
      .finally(() => {
        if (this.Queue.length) {
          console.log(`正在延迟执行捏:${delay} ms`);
          this.TimerId = setTimeout(this.runNext.bind(this), delay);
        } else {
          this.paused = true;
        }
      });
  }
  Queue = [];
}
module.exports = CommandSender;
