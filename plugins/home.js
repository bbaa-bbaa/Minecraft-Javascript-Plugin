const BasePlugin = require("../core/basePlugin.js");
const fs = require("fs-extra");
const _ = require("lodash");
const process = require("process");
let HomeData;
if (fs.existsSync("./home.json")) {
  HomeData = require(process.cwd() + "/home.json");
} else {
  HomeData = {};
}
const writeHomeData = _.debounce(() => {
  fs.writeFile("./home.json", JSON.stringify(HomeData), { encoding: "utf-8" });
}, 100);
class Home extends BasePlugin {
  static PluginName = "家";
  constructor() {
    super(...arguments);
  }
  init(Plugin) {
    Plugin.registerCommand("sethome", this.sethome.bind(this));
    Plugin.registerCommand("home", this.home.bind(this));
    Plugin.registerCommand("homelist", this.homelist.bind(this));
    Plugin.registerCommand("delhome", this.delhome.bind(this));
  }
  async sethome(Player, homename = "default") {
    let { pos, dim } = await this.getPlayerPosition(Player);
    this.tellraw(Player, [
      { text: "已在", color: "yellow" },
      { text: `维度[${this.getWorldName(dim)}]的[${pos.join(", ")}]`, color: "green" },
      { text: `设置家 ${homename}`, color: "yellow" }
    ]);
    if (!HomeData[Player]) {
      HomeData[Player] = {};
    }
    HomeData[Player][homename] = { pos, dim };
    writeHomeData();
  }
  async delhome(Player, homename = "default") {
    if (HomeData[Player][homename]) {
      delete HomeData[Player][homename];
      this.tellraw(Player, [{ text: `已删除家 ${homename}`, color: "yellow" }]);
      writeHomeData();
    } else {
      return this.tellraw(Player, [{ text: `你没有家` + homename, color: "red" }]);
    }
  }
  async homelist(Player) {
    const Colors = ["red", "yellow", "green", "aqua", "blue"];
    if (HomeData[Player]) {
      let Homes = Object.keys(HomeData[Player]);
      if (!Homes.length) {
        return this.tellraw(Player, [{ text: `你没有家`, color: "red" }]);
      }
      return this.tellraw(
        Player,
        [{ text: `你拥有家[以下选项可点击]: `, color: "yellow" }].concat(
          Homes.map((a, i) => {
            return {
              text: a + " ",
              color: Colors[i % Colors.length],
              clickEvent: { action: "suggest_command", value: `!!home ${a}` }
            };
          })
        )
      );
    } else {
      return this.tellraw(Player, [{ text: `你没有家`, color: "red" }]);
    }
  }
  async home(Player, homename = "default") {
    if (HomeData[Player] && HomeData[Player][homename]) {
      this.tellraw(Player, [{ text: `两秒后tp回家 「${homename}」`, color: "yellow" }]);
      setTimeout(() => {
        this.Teleport(Player, HomeData[Player][homename]);
      }, 2000);
      return;
    } else if (HomeData[Player]) {
      let MatchHomes = Object.keys(HomeData[Player]).filter(
        Home =>
          homename.length <= Home.length && Home.substring(0, homename.length).toLowerCase() == homename.toLowerCase()
      );
      if (MatchHomes.length) {
        this.tellraw(Player, [
          { text: `没有设置家 `, color: "yellow" },
          { text: `「${homename}」`, color: "red" }
        ]);
        this.tellraw(Player, [
          { text: "为你模糊匹配到家", color: "yellow" },
          { text: `「${MatchHomes[0]}」`, color: "green" },
          { text: " 两秒后传送", color: "yellow" }
        ]);
        setTimeout(() => {
          this.Teleport(Player, HomeData[Player][MatchHomes[0]]);
        }, 2000);
        return;
      }
    }
    this.tellraw(Player, [
      { text: `没有设置家 `, color: "red" },
      { text: `「${homename}」`, color: "red" }
    ]);
  }
  async Start() {}
}
module.exports = Home;
