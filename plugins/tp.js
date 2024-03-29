let BasePlugin = require("../core/basePlugin.js");
class TelePortCommand extends BasePlugin {
  static PluginName = "玩家传送命令";
  constructor() {
    super(...arguments);
  }
  init(Plugin) {
    Plugin.registerCommand("tp", this.tp.bind(this));
  }
  async tp(Player, Targetn) {
    if (!Targetn) return;
    let List = this.Players.map(a => a.trim()).filter(name => {
      return name.length >= Targetn.length && Targetn.toLowerCase() == name.substr(0, Targetn.length).toLowerCase();
    });
    if (List.length == 1) {
      let Target = List[0];
      let MyHealth = await this.Health.getHealthPlayer(Player);
      let TargetHealth = await this.Health.getHealthPlayer(Target);
      if (MyHealth <= 2) {
        this.tellraw(`${Player}`, [{ text: `濒死状态无法进TP操作`, color: "red", bold: false }]).catch(() => {});
        this.tellraw(`${Target}`, [
          {
            text: `${Player} 尝试TP到你，但是由于他的血量过低，TP失败`,
            color: "red",
            bold: false
          }
        ]).catch(() => {});
        return;
      }
      if (TargetHealth <= 8) {
        this.tellraw(`${Player}`, [
          {
            text: `你TP的目标${Target}血量过低，TP失败`,
            color: "red",
            bold: true
          }
        ]).catch(() => {});
        this.tellraw(`${Target}`, [
          {
            text: `${Player} 尝试TP到你，但是由于你的血量过低，TP失败`,
            color: "red",
            bold: true
          }
        ]).catch(() => {});
        return;
      }
      this.PluginLog(`执行 ` + `tp ${Player} ${Target}`);
      this.tellraw(`${Player}`, [{ text: `2秒后TP到${Target}`, color: "green", bold: true }]).catch(() => {});
      this.tellraw(`${Target}`, [{ text: `2秒后${Player} TP到你`, color: "green", bold: true }]).catch(() => {});
      setTimeout(() => {
        this.Teleport(Player, Target);
      }, 2000);
    } else {
      this.tellraw(`${Player}`, [{ text: "非唯一目标", color: "red", bold: true }]).catch(() => {});
    }
  }
  async Start() {}
}
module.exports = TelePortCommand;
