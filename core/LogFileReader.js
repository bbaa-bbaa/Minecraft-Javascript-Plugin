const fs = require("fs");
const _ = require("lodash");
const chokidar = require("chokidar");
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
    const curr = { size: (await fs.promises.stat(this.path).catch(a=>{return {size:0}})).size };
    let diff = curr.size - this.Pos;
    console.log(`[PluginsCore:LogFileReader]读取日志文件${diff}:${this.Pos}->${curr.size}`);
    if (diff < 0) {
      await this.closeLogFile();
      await this.openLogFile("LogFileUpdate");
      this.Pos = 0;
      diff = curr.size - this.Pos;
      return;
    } else if(!diff) {
      return
    }
    let buf=Buffer.alloc(diff)
    this.Handle.read(buf, 0, diff, this.Pos)
      .then(() => {
        this.Pos = curr.size;
        let Lines = buf.toString("utf8").split("\n");
        for (let Line of Lines) {
          if (Line.length == 0) {
            continue;
          }
          this.Core.ProcessLog(Line);
        }
      })
      .catch(e => {
        console.log(e);
      });
  }
  async watchLogfile() {
    console.log("[PluginsCore:LogFileReader]在[" + this.path + "]注册文件监听器");
    this.ac = new AbortController();
    const readFilef = _.debounce(this.readPartFile.bind(this), 100);
    try {
      this.watcher = chokidar.watch(this.path).on("all", (event, path) => {
        readFilef();
      });
    } catch (e) {}
  }
  async openLogFile(r = "WatcherInit") {
    try {
      this.Handle = await fs.promises.open(this.path, "r");
      this.Pos = (await fs.promises.stat(this.path).catch(a=>{return {size:0}})).size;
      console.log(`[${r}]打开日志 位移` + this.Pos);
    } catch (e) {
      console.error(e);
      return this.openLogFile(r);
    }
  }
  async closeLogFile() {
    console.log("[PluginsCore:LogFileReader]关闭日志文件");
    return this.Handle.close().catch(a=>Promise.resolve());
  }
  async close() {
    console.log("[PluginsCore:LogFileReader]关闭日志Watcher");
    await this.watcher.close();
    return this.closeLogFile();
  }
}
module.exports = LogFileReader;
