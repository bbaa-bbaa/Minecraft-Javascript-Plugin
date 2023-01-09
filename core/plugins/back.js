let BasePlugin = require("../basePlugin.js");
const process = require("process");
const colors = require("@colors/colors");
const _ = require("lodash");
const fs = require("fs-extra");
let LastPositionDbFile = process.cwd() + "/LastPositionDb.json";
let LastPositionDb;
if (fs.existsSync(LastPositionDbFile)) {
  LastPositionDb = require(LastPositionDbFile);
} else {
  LastPositionDb = {};
}
const writeLastPositionDb = _.debounce(() => {
  fs.writeFile(LastPositionDbFile, JSON.stringify(LastPositionDb), { encoding: "utf-8" });
}, 100);
class Back extends BasePlugin {
  static PluginName = "返回上一个地点";
  constructor() {
    super(...arguments);
  }
  init(Plugin) {
    Plugin.registerCommand("back", this.back);
  }
  async back(Player) {
    if (LastPositionDb[Player]) {
      let Position = LastPositionDb[Player];
      this.tellraw(Player, [
        { text: "两秒后为你传送回上一个地点: ", color: "yellow" },
        { text: "维度「", color: "aqua" },
        { text: this.getWorldName(Position.dim), color: "green" },
        { text: "」", color: "aqua" },
        { text: "「", color: "aqua" },
        { text: Position.pos.join(","), color: "green" },
        { text: "」", color: "aqua" }
      ]);
      setTimeout(()=>{
        this.Teleport(Player,Position);
      },2000)
    } else {
      this.tellraw(Player, [
        { text: "没有找到上一个地点的数据", color: "red" },
      ]);
    }
  }
  async updateBackPositionDatabase(PlayerName) {
    let Position = await this.getPlayerPosition(PlayerName).catch(a => {
      this.PluginLog("获取位置失败" + a);
      return "crash";
    });
    if (Position !== "crash") {
      LastPositionDb[PlayerName] = Position;
      this.PluginLog(
        `记录玩家${colors.green(PlayerName)}的坐标[${colors.green(Position.pos.join(","))}]在维度[${colors.green(
          this.getWorldName(Position.dim)
        )}]`
      );
      writeLastPositionDb();
    }
  }
  async Start() {}
}
module.exports = Back;
