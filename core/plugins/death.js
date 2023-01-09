let BasePlugin = require("../basePlugin.js");
const fs = require("fs");
class DeathCount extends BasePlugin {
  static PluginName = "死亡计数";
  constructor() {
    super(...arguments);
  }
  init(Plugin) {
    Plugin.registerNativeLogProcesser(/\]: [^ ]+? [\w ]+.*?$/, this.deathEvent);
  }
  async deathEvent(line) {
    let PlayerName = line.split("]: ")[1].split(" ")[0].trim();
    if (this.Players.indexOf(PlayerName) >= 0) {
      if (
        parseInt(
          (await this.CommandSender(`data get entity ${PlayerName} DeathTime`).catch(a => ":0s"))
            .split(":")[1]
            .replace(/s$/g, "")
        )
      ) {
        this.PluginLog(`玩家 ${PlayerName} 不幸离世`);
        this.updateBackPositionDatabase(PlayerName);
      }
    }
  }
  async Start() {
    await this.Scoreboard.ensureScoreboard({ name: "Death", type: "deathCount", displayname: "死亡次数" });
    await this.Scoreboard.displayScoreboard("Death", "sidebar");
  }
}
module.exports = DeathCount;
