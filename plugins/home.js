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
  }
  async sethome(Player) {
    let pos;
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
    }
    this.tellraw(Player, [
      { text: "已在", color: "yellow" },
      { text: `[${pos.join(", ")}]`, color: "green" },
      { text: "设置家", color: "yellow" }
    ]);
    HomeData[Player] = pos;
    writeHomeData();
  }
  async home(Player) {
    if (HomeData[Player]) {
      this.tellraw(Player, [{ text: "两秒后tp回家", color: "yellow" }]);
      setTimeout(() => {
        if (this.newVersion) {
          this.CommandSender(`tp @e[type="minecraft:player",limit=1,name="${Player}"] ${HomeData[Player].join(" ")}`).catch(() => {});
        } else {
          this.CommandSender(`tp ${Player} ${HomeData[Player].join(" ")}`).catch(() => {});
        }
      }, 2000);
    } else {
      this.tellraw(Player, [{ text: "没有设置家", color: "red" }]);
    }
  }
  async Start() {}
}
module.exports = Home;
