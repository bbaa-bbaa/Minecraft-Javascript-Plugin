const fs = require("fs");
const _ = require("lodash");
const chokidar = require("chokidar");
const colors = require("@colors/colors");
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
    const curr = {
      size: (
        await fs.promises.stat(this.path).catch(a => {
          return { size: 0 };
        })
      ).size
    };
    let diff = curr.size - this.Pos;
    console.log(
      `${colors.yellow("[")}${colors.green("PluginsCore:LogFileReader")}${colors.yellow("]读取日志文件")}${colors.red(
        diff
      )}:${colors.green(this.Pos)}${colors.blue("->")}${colors.magenta(curr.size)}`
    );
    if (diff < 0) {
      await this.closeLogFile();
      await this.openLogFile("LogFileUpdate");
      this.Pos = 0;
      diff = curr.size - this.Pos;
      return;
    } else if (!diff) {
      return;
    }
    this.Handle.read(Buffer.alloc(diff), 0, diff, this.Pos)
      .then(({ bytesRead, buffer }) => {
        this.Pos = curr.size;
        let Lines = buffer.toString("utf8").split("\n");
        for (let Line of Lines) {
          if (Line.length == 0 || Line.length > 200) {
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
    console.log(
      `${colors.yellow("[")}${colors.green("PluginsCore:LogFileReader")}${colors.yellow("]在[")}` +
        colors.magenta(this.path) +
        colors.yellow("]注册文件监听器")
    );
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
      this.Pos = (
        await fs.promises.stat(this.path).catch(a => {
          return { size: 0 };
        })
      ).size;
      console.log(
        `${colors.yellow("[")}${colors.green("PluginsCore:LogFileReader/" + r)}${colors.yellow("打开日志 位移")}` +
          colors.magenta(this.Pos)
      );
    } catch (e) {
      console.error(e);
      return this.openLogFile(r);
    }
  }
  async closeLogFile() {
    console.log(`${colors.yellow("[")}${colors.green("PluginsCore:LogFileReader")}${colors.yellow("]关闭日志文件")}`);
    return this.Handle.close().catch(a => Promise.resolve());
  }
  async close() {
    console.log(
      `${colors.yellow("[")}${colors.green("PluginsCore:LogFileReader")}${colors.yellow("]关闭日志Watcher")}`
    );
    await this.watcher.close();
    return this.closeLogFile();
  }
}
module.exports = LogFileReader;
