let BasePlugin = require("../core/basePlugin.js");
let nbttool = require("nbt-ts");
function parseText(Text) {
  let Keyword = ["bold", "italic", "underlined", "strikethrough", "obfuscated"];
  if (Text[0] != "[") {
    Text = "[]" + Text;
  }
  let regexp = /\[([^\]]*?)\]([^\[]+)/g;
  let match;
  let Formatted = [];
  let lastOption = {};
  while ((match = regexp.exec(Text))) {
    let [_unused, _options, text] = match;
    _options = _options.split(",");
    let options = [],
      color = "";
    for (let o of _options) {
      if (Keyword.includes(o.toLowerCase())) {
        options.push(o.toLowerCase());
      } else {
        color = o;
      }
    }
    let f = { text };
    if (color) {
      Object.assign(f, { color });
    }
    let _o = {};
    for (let [option, Value] of Object.entries(lastOption)) {
      if (Value) {
        _o[option] = false;
      }
    }
    for (let option of options) {
      _o[option] = true;
    }
    Object.assign(f, _o);
    lastOption = _o;
    Formatted.push(f);
  }
  return Formatted;
}
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
    args = args.join(" ");
    this.CommandSender(
      `data get entity @e[limit=1,name="${Player}"] SelectedItem`
    ).then(async a => {
      let basenbt = nbttool.parse(a.substring(a.indexOf(":") + 1).trim());
      let Tag = basenbt.tag;
      let FormatArray = [];
      try {
        if (!Tag) Tag={}
        if (!Tag.display) Tag.display = {};
        FormatArray = parseText(args);
        Tag.display.Name = JSON.stringify(FormatArray);
      } catch (e) {
        console.error(e);
        return this.tellraw(Player, [{ text: "不规范的参数", color: "red" }]);
      }
      this.tellraw(Player, [
        { text: "正在修改你主手上的物品名称为", color: "red" },
        ...FormatArray,
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
