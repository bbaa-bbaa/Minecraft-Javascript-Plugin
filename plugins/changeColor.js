let BasePlugin = require("../core/basePlugin.js");
let nbttool = require("nbt-ts");

class ChangeColor extends BasePlugin {
  static PluginName = "修改颜色";
  constructor() {
    super(...arguments);
  }
  init(Plugin) {
    if (!this.newVersion) return;
    Plugin.registerCommand("changecolor", this.color.bind(this));
  }
  async color(Player, ...args) {
    let nbt = args.join(" ");
    this.CommandSender(
      `data get entity @e[limit=1,name="${Player}"] SelectedItem`
    ).then(async a => {
      let basenbt = nbttool.parse(a.substring(a.indexOf(":") + 1).trim());
      let Tag = basenbt.tag;
      try {
        if (!Tag.display) Tag.display = {};
        Tag.display.Name = JSON.stringify(JSON.parse(nbt));
      } catch (e) {
        console.error(e);
        return this.tellraw(Player, [{ text: "不规范的参数", color: "red" }]);
      }
      this.tellraw(Player, [
        { text: "正在修改你主手上的物品名称", color: "red" },
      ]);
      return this.CommandSender(
        `item replace entity @e[limit=1,name="${Player}"] weapon.mainhand with ${
          basenbt.id
        }${nbttool.stringify(Tag)} ${Number(basenbt.Count)}`
      );
    });
  }
  async Start() {}
}
module.exports = ChangeColor;
