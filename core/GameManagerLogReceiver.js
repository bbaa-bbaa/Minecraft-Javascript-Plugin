const colors = require("@colors/colors");
class GameManagerLogReceiver {
  constructor(Core, ipc) {
    this.Core = Core;
    this.ipc = ipc;
    this.init(ipc);
  }
  processLog(message) {
    if (message.length == 0 || message.length > 200) {
      return;
    }
    this.Core.ProcessLog(message);
  }
  init(ipc) {
    console.log(
      `${colors.yellow("[")}${colors.green("PluginsCore:MinecraftLogReceiver")}${colors.yellow("]初始化日志接收器")}`
    );
    ipc.on("MinecraftLog", this.processLog.bind(this));
  }
}
module.exports = GameManagerLogReceiver;
