const BasePlugin = require("../core/basePlugin.js");
const nbttool = require("nbt-ts");
const pako = require("pako");
const fs = require("fs-extra");
function parseText(Text) {
  let Keyword = ["bold", "italic", "underlined", "strikethrough", "obfuscated"];
  if (Text[0] != "[") {
    Text = "[]" + Text;
  }
  let regexp = /\[([^\]]*?)\]([^\[]+)/g;
  let match;
  let Formatted = [];
  let lastOption = [];
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
    for (let option of lastOption) {
      _o[option] = false;
    }
    for (let option of options) {
      _o[option] = true;
    }
    Object.assign(f, _o);
    lastOption = options;
    Formatted.push(f);
  }
  return Formatted;
}
class ChangeColor extends BasePlugin {
  static PluginName = "修改物品名称";
  constructor() {
    super(...arguments);
  }
  init(Plugin) {
    if (!this.newVersion) {
      this.PluginLog(`旧模式`)
      Plugin.registerCommand("changecolor", this.colorNew.bind(this));
      return this.PluginLog(`颜色代码不支持旧版本Minecraft，跳过加载`);
    } else {
      this.PluginLog(`新版本模式`)
      Plugin.registerCommand("changecolor", this.colorNew.bind(this));
    }
  }
  async colorOld(Player,...args){
    let uuid = await this.getUUID(Player);
    await this.CommandSender(`save-all`);
    let buf = await fs.promises
      .readFile(`${this.Core.BaseDir}/world/playerdata/${uuid}.dat`)
      .catch(() => Buffer.allocUnsafe(0));
    if (!buf.byteLength) return;
    buf = Buffer.from(pako.inflate(buf));
    let nbtFileReader = nbttool.decode(buf).value;
    const SelectedItemSlot = Number(nbtFileReader.SelectedItemSlot);
    basenbt = nbtFileReader.Inventory.find(a => Number(a.Slot) == SelectedItemSlot);
    return;
  }
  async colorNew(Player, ...args) {
    args = args.join(" ");
    let basenbt;
    const rawNbt = await this.CommandSender(
      `data get entity @e[type="minecraft:player",limit=1,name="${Player}"] SelectedItem`
    );
    basenbt = nbttool.parse(rawNbt.substring(rawNbt.indexOf(":") + 1).trim());
    let Tag = basenbt.tag;
    let FormatArray = [];
    try {
      if (!Tag) Tag = {};
      if (!Tag.display) Tag.display = {};
      FormatArray = parseText(args);
      Tag.display.Name = JSON.stringify(FormatArray);
    } catch (e) {
      console.error(e);
      return this.tellraw(Player, [{ text: "不规范的参数", color: "red" }]);
    }
    this.tellraw(Player, [{ text: "正在修改你主手上的物品名称为", color: "red" }, ...FormatArray]);
    return this.CommandSender(
      `item replace entity @e[type="minecraft:player",limit=1,name="${Player}"] weapon.mainhand with ${
        basenbt.id
      }${nbttool.stringify(Tag)} ${Number(basenbt.Count)}`
    );
  }
  async Start() {}
}
module.exports = ChangeColor;
