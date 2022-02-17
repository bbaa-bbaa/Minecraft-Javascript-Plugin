const fs = require("fs");
const _ = require("lodash");
class LogFileReader {
  constructor(Core, path) {
    this.Handle = null;
    this.Pos = 0;
    this.Core = Core;
    this.path = path;

    this.openLogFile();
    this.watchLogfile();
  }
  async readPartFile() {
    const curr = { size: (await fs.promises.stat(this.path)).size };
    if (curr.size - this.Pos <= 0) return;
    this.Handle.read(
      Buffer.alloc(curr.size - this.Pos),
      0,
      curr.size - this.Pos,
      this.Pos
    )
      .then(({ bytesRead, buffer }) => {
        this.Pos = curr.size;
        let Str = buffer.toString("utf8").split("\n");
        for (let Line of Str) {
          if (Line.length == 0) continue;
          this.Core.ProcessLog(Line);
        }
      })
      .catch(() => {});
  }
  async watchLogfile() {
    console.log("在[" + this.path + "]注册文件监听器");
    this.ac = new AbortController();
    const readFilef = _.debounce(this.readPartFile.bind(this), 100);
    const openLogFilef = _.debounce((a) => {
      this.closeLogFile();
      this.openLogFile(a);
    }, 1000);
    try {
      const watcher = fs.promises.watch(this.path, { signal: this.ac.signal });
      for await (const event of watcher) {
        switch (event.eventType) {
          case "change":
            readFilef();
            break;
          case "rename":
            if (/latest/.test(event.filename)) {
              openLogFilef("FileWatcher")
            }
            break;
        }
      }
    } catch (e) {}
  }
  async openLogFile(r = "WatcherInit") {
    try {
      this.Handle = await fs.promises.open(this.path, "r");
      this.Pos = (await fs.promises.stat(this.path)).size;
      console.log(`[${r}]打开日志 位移` + this.Pos);
    } catch (e) {
      console.error(e);
      this.openLogFile(r);
    }
    // fs.watchFile(this.path, { interval: 100 }, (...args)=>{this.readPartFile(...args)});
  }
  async closeLogFile() {
    //fs.unwatchFile(this.path)
    this.Handle.close();
    console.log("关闭日志文件");
  }
  close() {
    console.log("关闭日志Watcher");
    this.ac.abort();
    this.closeLogFile();
  }
}
module.exports = LogFileReader;
