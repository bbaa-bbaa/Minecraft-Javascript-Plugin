let BasePlugin = require("../core/basePlugin.js");
class DeathCount extends BasePlugin {
  static PluginName = "死亡榜";
  constructor() {
    super(...arguments);
  }
  init(Plugin) {
  }
  async Start() {
    await this.Scoreboard.ensureScoreboard({ name: "Death", type: "deathCount", displayname: "死亡次数" });
    await this.Scoreboard.displayScoreboard("Death", "sidebar");
  }
}
module.exports = DeathCount;
