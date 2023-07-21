let BasePlugin = require("../basePlugin.js");
const fs = require("fs");
class PlayerHealth extends BasePlugin {
  static PluginName = "玩家血量";
  constructor() {
    super(...arguments);
  }
  init(Plugin) {
  }
  async updateHealth(PlayerName){
    return this.Scoreboard.updateScore(PlayerName, "Health");
  }
  async HealthList(){
    return this.getScoreByName("Health")
  }
  async getHealthPlayer(PlayerName){
    await this.updateHealth(PlayerName);
    return (await this.HealthList())[PlayerName]
  }
  async Start() {
    await this.Scoreboard.ensureScoreboard({
      name: "Health",
      type: "health",
      displayname: "health"
    });
    await this.Scoreboard.displayScoreboard("Health", "list");
  }
}
module.exports = PlayerHealth;
