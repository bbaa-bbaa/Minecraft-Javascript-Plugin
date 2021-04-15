const fs = require("fs");
class LogFileReader {
  constructor(Core) {
    this.Handle = null;
    this.Pos = 0;
    this.Core = Core;
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
}
module.exports = LogFileReader;
