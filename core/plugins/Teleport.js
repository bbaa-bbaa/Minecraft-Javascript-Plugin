let BasePlugin = require(__dirname + "/../basePlugin.js");
const nbttool = require("nbt-ts");
class Teleport extends BasePlugin {
  static PluginName = "传送内核插件";
  constructor() {
    super(...arguments);
  }
  init(Plugin) {
    this.Core.Teleport = async (Source, Target) => {
      return this.Teleport(Source, Target);
    };
  }
  async Teleport(Source, Target, retry = 0) {
    if (this.newVersion) {
      if (this.Core.Players.indexOf(Target) > -1) {
        Target = await this.getPlayerPosition(Target).catch(() => {
          return "crash";
        });
        if (Target == "crash" && retry < 3) {
          return this.Teleport(Source, Target, ++retry);
        }
      }
      this.CommandSender(`execute as ${this.PlayerWarpper(Source)} rotated as ${this.PlayerWarpper(Source)} in ${Target.dim} run teleport ${this.SelectorWarpper(Target)}`)
    }
    else {
      if (!this.isForge) {
        this.CommandSender(`tp ${this.PlayerWarpper(Source)} ${this.SelectorWarpper(Target)}`).catch(() => { });
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
