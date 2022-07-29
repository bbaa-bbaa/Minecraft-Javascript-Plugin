let BasePlugin = require(__dirname + "/../basePlugin.js");
const nbttool = require("nbt-ts");
class Teleport extends BasePlugin {
  static PluginName = "传送内核插件";
  constructor() {
    super(...arguments);
    this.lastTeleport = 0;
  }
  init(Plugin) {
    this.Core.Teleport = async (Source, Target) => {
      return this.Teleport(Source, Target);
    };
  }
  async Teleport(Source, Target, retry = 0) {
    if (this.MSPT > 50) {
      this.tellraw("@a", [
        { text: "服务器状态异常，本次TP取消 ", color: "red", bold: true },
        { text: "服务器负载：", color: "yellow", bold: true },
        { text: `${((this.MSPT / 50) * 100).toFixed(2)}%`, color: "red", bold: true }
      ]);
      return;
    }
    if (!retry) {
      if (new Date().getTime() - this.lastTeleport < 5000) {
        this.tellraw(this.SelectorWarpper(Source), [
          { text: "与上次TP间隔过短，本次TP取消", color: "red", bold: true }
        ]);
        if (typeof Target != "object") {
          this.tellraw(this.SelectorWarpper(Target), [
            { text: "与上次TP间隔过短，本次TP取消", color: "red", bold: true }
          ]);
        }
        return;
      }
      this.lastTeleport = new Date().getTime();
    }
    if (this.newVersion) {
      let ret = "";
      if (!retry && typeof Target != "object") {
        this.PluginLog("尝试非跨世界tp");
        ret = await this.CommandSender(`tp ${this.SelectorWarpper(Source)} ${this.SelectorWarpper(Target)}`);
      }
      if (ret.substring(0, "Teleported".length) != "Teleported" || retry > 0) {
        this.PluginLog("跨世界tp");
        if (typeof Target != "object") {
          Target = await this.getPlayerPosition(Target).catch(a => {
            console.log("获取位置失败" + a);
            return "crash";
          });
          if (Target == "crash" && retry < 3) {
            return this.Teleport(Source, Target, ++retry);
          }
        }
        if (Target.dim) {
          await this.CommandSender(
            `execute as ${this.PlayerWarpper(Source)} rotated as ${this.PlayerWarpper(Source)} in ${
              Target.dim
            } run teleport ${this.SelectorWarpper(Target)}`
          );
        } else if (!Target.dim) {
          await this.CommandSender(
            `execute as ${this.PlayerWarpper(Source)} rotated as ${this.PlayerWarpper(
              Source
            )} run teleport ${this.SelectorWarpper(Target)}`
          );
        }
      }
    } else {
      if (!this.isForge) {
        this.CommandSender(`tp ${this.PlayerWarpper(Source)} ${this.SelectorWarpper(Target)}`).catch(() => {});
      } else {
        if (this.Core.Players.indexOf(Target) > -1) {
          Target = await this.getPlayerPosition(Target).catch(() => {
            return "crash";
          });
          if (Target == "crash" && retry < 3) {
            return this.Teleport(Source, Target, ++retry);
          }
        }
        this.PluginLog(`执行命令：forge setdim ${this.PlayerWarpper(Source)} ${this.SelectorWarpper(Target)}`);
        return this.CommandSender(`forge setdim ${this.PlayerWarpper(Source)} ${this.SelectorWarpper(Target)}`).then(
          changedim => {
            if (/is already in the dimension specified/.test(changedim)) {
              this.PluginLog(`执行命令：tp ${this.PlayerWarpper(Source)} ${this.PositionWarpper(Target, true)}`);
              return this.CommandSender(`tp ${this.PlayerWarpper(Source)} ${this.PositionWarpper(Target, true)}`);
            }
          }
        );
      }
    }
  } /*
  async Teleport(Source, Target) {
    if (!this.isForge||true) {
        this.CommandSender(`tp ${this.SelectorWarpper(Source)} ${this.SelectorWarpper(Target)}`).catch(() => {});
    } else {
      this.PluginLog("执行命令:"+`tpx ${this.SelectorWarpper(Source)} ${this.SelectorWarpper(Target)}`)
      await this.CommandSender(`tpx ${this.SelectorWarpper(Source)} ${this.SelectorWarpper(Target)}`);
    }
  }*/
  PositionWarpper(Position, forceNotMultWorld = false) {
    if (this.newVersion) {
      return Position.pos.join(" ");
    }
    if (typeof Position == "object" && "dim" in Position) {
      if (this.isForge && !forceNotMultWorld) {
        return `${Position.dim} ${Position.pos.join(" ")}`;
      } else {
        return `${Position.pos.join(" ")}`;
      }
    } else if (Position instanceof Array) {
      return Position.join(" ");
    } else {
      return Position;
    }
  }
  SelectorWarpper(Selector) {
    if (Selector instanceof Array && Selector.length == 3) {
      return this.PositionWarpper(Selector);
    } else if (typeof Selector == "string" && Selector.split(" ").map(a => a.trim()).length == 3) {
      return this.PositionWarpper(Selector);
    } else if (typeof Selector == "object" && "dim" in Selector) {
      return this.PositionWarpper(Selector);
    } else {
      return this.PlayerWarpper(Selector);
    }
  }
  async Start() {
    //let text = await this.CommandSender("forge dimensions");
    if (this.isForge) {
      this.PluginLog("为Forge 多世界游戏，启用跨世界TP支持");
      return;
    }
  }
}
module.exports = Teleport;
