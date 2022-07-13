let BasePlugin = require(__dirname + "/../basePlugin.js");
const nbttool = require("nbt-ts");
class Teleport extends BasePlugin {
  static PluginName = "传送内核插件";
  constructor() {
    super(...arguments);
    this.MultiWorld = false;
  }
  init(Plugin) {
    this.Core.Teleport = async (Source, Target) => {
      return this.Teleport(Source, Target);
    };
  }/*
  async Teleport(Source, Target) {
    if (!this.MultiWorld) {
      this.CommandSender(`tp ${this.SelectorWarpper(Source)} ${this.SelectorWarpper(Target)}`).catch(() => {});
    } else {
      if (this.Core.Players.indexOf(Target) > -1) {
        Target = await this.getPlayerPosition(Target);
      }
      this.PluginLog(`执行命令：forge setdim ${this.SelectorWarpper(Source)} ${this.SelectorWarpper(Target)}`)
      return this.CommandSender(`forge setdim ${this.SelectorWarpper(Source)} ${this.SelectorWarpper(Target)}`);
    }
  }*/
  async Teleport(Source, Target) {
    if (!this.MultiWorld||true) {
        this.CommandSender(`tp ${this.SelectorWarpper(Source)} ${this.SelectorWarpper(Target)}`).catch(() => {});
    } else {
      this.PluginLog("执行命令:"+`tpx ${this.SelectorWarpper(Source)} ${this.SelectorWarpper(Target)}`)
      await this.CommandSender(`tpx ${this.SelectorWarpper(Source)} ${this.SelectorWarpper(Target)}`);
    }
  }
  PlayerWarpper(Player) {
    if (this.newVersion) {
      return `@e[type="minecraft:player",limit=1,name="${Player}"]`;
    } else {
      return Player;
    }
  }
  PositionWarpper(Position) {
    if (typeof Position == "object" && "dim" in Position) {
      if (this.MultiWorld) {
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
  async getPlayerPosition(Player) {
    let pos, dim;
    if (!this.newVersion) {
      await this.CommandSender(
        `execute ${Player} ~ ~ ~ summon minecraft:armor_stand ~ ~ ~ {CustomName:"TeleportProber_${Player}",Invulnerable:1b,NoGravity:1b,Invisible:true}`
      );
      const entityData = await this.CommandSender(`entitydata @e[name=TeleportProber_${Player}] {}`);
      await this.CommandSender(`kill @e[name=TeleportProber_${Player}]`);
      let Nbt = nbttool.parse(entityData.substring(entityData.indexOf(":") + 1).trim());
      pos = Nbt.Pos.map(b => b.toFixed(2));
      dim = Number(Nbt.Dimension);
    }
    return { pos, dim };
  }
  async Start() {
    let text = await this.CommandSender("forge dimensions");
    if (/Currently registered dimensions by type/.test(text)) {
      this.PluginLog("为Forge 多世界游戏，启用跨世界TP支持");
      this.MultiWorld = true;
      return;
    }
  }
}
module.exports = Teleport;
