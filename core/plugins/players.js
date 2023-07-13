const BasePlugin = require(__dirname + "/../basePlugin.js");

class PlayerLists extends BasePlugin {
  static PluginName = "玩家数量";
  constructor() {
    super(...arguments);
    this._Players = [];
    this.LoopId = 0;
  }
  init(Plugin) {
    Plugin.registerNativeLogProcesser(/ (left|joined) the game/, () => {this.updatePlayerLists() });
    Object.defineProperty(this.Core, "Players", {
      get: () => {
        return this._Players;
      }
    });
  }
  async Start() {
    /*this.LoopId = setInterval(() => {
      this.updatePlayerLists(false);
    }, 1000);*/
    return this.updatePlayerLists(true);
  }
  async Pause() {
    //clearInterval(this.LoopId);
  }
  async updatePlayerLists(first) {
    let list = await this.CommandSender("list");
    if (list) {
      list = list.split(":");
    } else {
      return;
    }
    if (list.length == 0) {
      if (this._Players.length !== 0) {
        this.emit("playerlistchange", this._Players);
      }
      this._Players = [];
      return this._Players;

    }
    let Players = list[1]
      .split(",")
      .map(a => a.trim())
      .filter(a => a);
    if (this._Players.length != Players.length && !first) {
      this.emit("playerlistchange", Players);
    }
    this._Players = Players;
    return this._Players;
  }
}
module.exports = PlayerLists;
