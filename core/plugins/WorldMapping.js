const _WorldMapping = {
  overworld: "主世界",
  Overall: "所有",
  vox_ponds: "未知",
  the_nether: "地狱",
  candyland: "糖果",
  deeplands: "深层",
  mysterium: "秘境",
  immortallis: "不朽",
  barathos: "爵士",
  lborean: "暴风",
  ancient_cavern: "远古神殿",
  the_end: "末地",
  runandor: "符境",
  crystevia: "晶体",
  gardencia: "花园",
  celeve: "玩具",
  lelyetia: "赫尔维蒂",
  precasia: "传说",
  iromine: "黄金",
  greckon: "格瑞克",
  creeponia: "蠕变",
  dustopia: "异位",
  shyrelands: "塞尔瑞",
  lunalus: "月球",
  haven: "天堂",
  abyss: "深渊",
  twilight_forest: "暮色森林",
  nether: "地狱"
};
let WorldMapping = {};
for (let [name, value] of Object.entries(_WorldMapping)) {
  WorldMapping[name.toUpperCase()] = value;
}
const BasePlugin = require(__dirname + "/../basePlugin.js");

class WorldsMapping extends BasePlugin {
  static PluginName = "世界序号映射";
  constructor() {
    super(...arguments);
    this.WorldMapping = { disName: WorldMapping, id: { 0: "overworld", 1: "the_end", "-1": "Nether" } };
  }
  init(Plugin) {
    this.Core.WorldMapping = this.WorldMapping;
  }
  async Start() {
    return this.getWorldMapping();
  }
  async Pause() { }
  async getWorldMapping() {
    if (this.isForge && !this.newVersion) {
      let text = await this.CommandSender("forge dimensions");
      if (!/Currently registered dimensions by type/.test(text)) {
        this.PluginLog("非Forge 多世界游戏，终止映射");
        return;
      }
      const map = text
        .replace("Currently registered dimensions by type:", "")
        .replace(/\{/g, "")
        .split("}")
        .map(a => a.split(":").map(b => b.trim()))
        .filter(a => a.length == 2)
        .map(a => {
          a[1] = a[1].split(",").map(b => b.trim());
          return a;
        });
      for (let [name, ids] of map) {
        for (let id of ids) {
          this.WorldMapping.id[id] = name;
        }
      }
      this.PluginLog(`映射完成，共${Object.keys(this.WorldMapping.id).length}个世界`);
    } else if(this.newVersion) {
      this.PluginLog("新版本游戏，无需映射");
    }
    
  }
}
module.exports=WorldsMapping;
