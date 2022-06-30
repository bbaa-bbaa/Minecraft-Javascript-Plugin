const BasePlugin = require("../core/basePlugin.js");
const fs = require("fs-extra");
const _ = require("lodash");
const process = require("process");
const nbttool = require("nbt-ts");
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
    let pos;
    let dim = 0;
    if (this.newVersion) {
      this.CommandSender(`data get entity @e[type="minecraft:player",limit=1,name="${Player}"] Pos`).then(async a => {
        pos = a
          .split("[")[1]
          .replace(/(\]|d)/g, "")
          .split(",")
          .map(b => Number(b.trim()).toFixed(2));
      });
    } else {
      await this.CommandSender(
        `execute ${Player} ~ ~ ~ summon minecraft:armor_stand ~ ~ ~ {CustomName:"setHomePlugin_${Player}",Invulnerable:1b,NoGravity:1b,Invisible:true}`
      );
      const entityData = await this.CommandSender(`entitydata @e[name=setHomePlugin_${Player}] {}`);
      await this.CommandSender(`kill @e[name=setHomePlugin_${Player}]`);
      let Nbt = nbttool.parse(entityData.substring(entityData.indexOf(":") + 1).trim());
      pos = Nbt.Pos.map(b => b.toFixed(2));
      dim = Number(Nbt.Dimension);
    }
    this.tellraw(Player, [
      { text: "已在", color: "yellow" },
      { text: `维度[${this.getWorldName(dim)}]的[${pos.join(", ")}]`, color: "green" },
      { text: `设置家 ${homename}`, color: "yellow" }
    ]);

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
        [{ text: `你拥有家: `, color: "yellow" }].concat(
          Homes.map((a, i) => {
            return { text: a + " ", color: Colors[i % Colors.length] };
          })
        )
      );
    } else {
      return this.tellraw(Player, [{ text: `你没有家`, color: "red" }]);
    }
  }
  async home(Player, homename = "default") {
    if (HomeData[Player][homename]) {
      this.tellraw(Player, [{ text: `两秒后tp回家 ${homename}`, color: "yellow" }]);
      setTimeout(() => {
        this.Teleport(Player,HomeData[Player][homename])
      }, 2000);
    } else {
      this.tellraw(Player, [{ text: `没有设置家 ${homename}`, color: "red" }]);
    }
  }
  async Start() {}
}
module.exports = Home;
