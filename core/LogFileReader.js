const fs = require("fs-extra");
class LogFileReader {
  constructor(Core,path) {
    this.Handle = null;
    this.Pos = 0;
    this.Core = Core;
    this.path=path;
    this.openLogFile()
  }
  readPartFile(curr, prev) {
    if(curr.size - this.Pos<=0) return
    this.Handle.read(Buffer.alloc(curr.size - this.Pos), 0, curr.size - this.Pos, this.Pos).then(({bytesRead,buffer}) => {
      this.Pos = curr.size
      let Str = buffer.toString("utf8").split("\n");
      for (let Line of Str) {
        if(Line.length == 0) continue
        this.Core.ProcessLog(Line);
      }
    });
  }
  async openLogFile() {
    this.Handle = await fs.promises.open(this.path, "r");
    this.Pos = (await fs.promises.stat(this.path)).size;
    console.log("打开日志 位移"+this.Pos)
    fs.watchFile(this.path, { interval: 100 }, (...args)=>{this.readPartFile(...args)});
  }
  async close(){
    fs.unwatchFile(this.path)
    this.Handle.close();
  }
}
module.exports = LogFileReader;
