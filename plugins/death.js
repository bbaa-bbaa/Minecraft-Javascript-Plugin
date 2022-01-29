let BasePlugin = require("../core/basePlugin.js");
class DeathCount extends BasePlugin {
  static PluginName = "倒地榜";
  constructor() {
    super(...arguments);
  }
  init(Plugin) {
  //  Plugin.registerNativeLogProcesser(/\w+ is bleeding.../, this.addCount);
  }
  async Start() {
    await this.Scoreboard.ensureScoreboard({ name: "Death", type: "deathCount", displayname: "倒地榜" });
    await this.Scoreboard.displayScoreboard("Death", "sidebar");
  }
}
module.exports = DeathCount;
