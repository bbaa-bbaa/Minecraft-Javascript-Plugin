const BasePlugin = require(__dirname + "/../basePlugin.js");

class PlayerLists extends BasePlugin {
  static PluginName = "玩家数量";
  constructor() {
    super(...arguments);
    this.Players = [];
    this.LoopId = 0;
  }
  init(Plugin) {
    Plugin.registerNativeLogProcesser(/\w+ joined the game/, () => {this.updatePlayerLists() });
    Plugin.registerNativeLogProcesser(/\w+ left the game/, () => { this.updatePlayerLists() });
    Object.defineProperty(this.Core, "Players", {
      get: () => {
        return this.Players;
      }
    });
  }
  async Start() {
    this.LoopId = setInterval(() => {
      this.updatePlayerLists(false);
    }, 10000);
    return this.updatePlayerLists(true);
  }
  async Pause() {
    clearInterval(this.LoopId);
  }
  async updatePlayerLists(first) {
    let list = await this.CommandSender("list");
    if (list) {
      list = list.split(":");
    } else {
      return;
    }
    if (list.length == 0) {
      if (this.Players.length !== 0) {
        this.Core.EventBus.emit("playerlistchange", this.Players);
      }
      this.Players = [];
      return this.Players;

    }
    let Players = list[1]
      .split(",")
      .map(a => a.trim())
      .filter(a => a);
    if (this.Players.length != Players.length && !first) {
      this.Core.EventBus.emit("playerlistchange", Players);
    }
    this.Players = Players;
    return this.Players;
  }
}
module.exports = PlayerLists;
