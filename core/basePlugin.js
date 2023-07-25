const crypto = require("crypto");
const fs = require("fs");
const uuid = require("uuid").stringify;
const colors = require("@colors/colors");
let uuidCache = {};
const nbttool = require("nbt-ts");
class BasePlugin {
  get platform() {
    return this.Core.platform;
  }
  constructor(Core) {
    this.Core = Core;
    const hash = crypto.createHash("sha1");
    this.Scoreboard_Prefix = hash.update(this.constructor.name).digest("hex");
    this._Scoreboard = null;
  }
  get Settings() {
    return this.Core.PluginSettings[this.constructor.name] || {};
  }
  get ipc() {
    return this.Core.ipc;
  }
  get isForge() {
    return this.Core.isForge;
  }
  emit(...a) {
    return this.Core.EventBus.emit(...a);
  }
  PlayerWarpper(Player) {
    if (this.newVersion && Player[0] != "@") {
      return `@a[limit=1,name="${Player}"]`;
    } else if (!this.newVersion) {
      return `@a[c=1,name=${Player}]`;
    }
    return Player;
  }
  async getPlayerPosition(Player) {
    let pos, dim;
    if (!this.newVersion) {
      await this.CommandSender(
        `execute ${Player} ~ ~ ~ summon minecraft:armor_stand ~ ~ ~ {CustomName:"getPlayerPositionProber_${Player}",Invulnerable:1b,NoGravity:1b,Invisible:true}`
      );
      const entityData = await this.CommandSender(`entitydata @e[name=getPlayerPositionProber_${Player}] {}`);
      await this.CommandSender(`kill @e[name=getPlayerPositionProber_${Player}]`);
      let Nbt = nbttool.parse(entityData.substring(entityData.indexOf(":") + 1).trim());
      pos = Nbt.Pos.map(b => b.toFixed(2));
      dim = Number(Nbt.Dimension);
    } else {
      const entityPosData = await this.CommandSender(`data get entity ${this.PlayerWarpper(Player)} Pos`);
      console.log(entityPosData);
      const entityDimensionData = await this.CommandSender(`data get entity ${this.PlayerWarpper(Player)} Dimension`);
      pos = nbttool.parse(entityPosData.substring(entityPosData.indexOf(":") + 1).trim()).map(b => b.toFixed(2));
      console.log(entityDimensionData.substring(entityDimensionData.indexOf(":") + 1).trim());
      dim = nbttool.parse(entityDimensionData.substring(entityDimensionData.indexOf(":") + 1).trim()).trim();
    }
    return { pos, dim };
  }
  PluginLog(t) {
    console.log(
      `${colors.yellow("[")}${colors.green(this.constructor.PluginName)}${colors.yellow("]")}` + colors.magenta(t)
    );
  }
  getWorldName(a) {
    if (this.newVersion) {
      a = a.split(":").pop();
    } else {
      if (typeof Number(a) == "number" && !isNaN(Number(a))) {
        a = this.Core.WorldMapping.id[a];
      }
    }
    if (this.Core.WorldMapping.disName[a.toUpperCase()]) {
      return this.Core.WorldMapping.disName[a.toUpperCase()];
    }
    return a;
  }
  Teleport(Source, Target) {
    return this.Core.Teleport(Source, Target);
  }
  ConvertUUID(_IntArray) {
    const arr = new ArrayBuffer(16);
    const view = new DataView(arr);
    for (let [i, item] of _IntArray.entries()) {
      view.setInt32(i * 4, item, false);
    }
    return uuid(new Uint8Array(arr));
  }
  async getUUID(Player) {
    if (uuidCache[Player] && uuidCache[Player] != "00000000-0000-0000-0000-000000000000") return uuidCache[Player];
    if (this.newVersion) {
      uuidCache[Player] = this.ConvertUUID(
        await this.CommandSender(`data get entity @e[type=minecraft:player,limit=1,name="${Player}"] UUID`)
          .then(a => {
            return a
              .split(";")[1]
              .replace(/\]/g, "")
              .split(",")
              .map(b => Number(b.trim()));
          })
          .catch(b => [0, 0, 0, 0])
      );
    } else {
      let UUIDLIST = (await fs.promises.readdir(`${this.Core.BaseDir}/world/playerdata`))
        .filter(a => /\.dat$/.test(a))
        .map(a => a.split(".").shift());
      for (let UUID of UUIDLIST) {
        let Playername = (await this.CommandSender(`scoreboard players list ${UUID}`)).match(
          /Showing \d* tracked objective\(s\) for (.*?):/
        );
        if (Playername) {
          uuidCache[Playername[1]] = UUID;
        }
      }
    }
    return uuidCache[Player];
  }
  async CommandSender(cmd) {
    // this.PluginLog(`[${new Date().getTime()}]执行命令:`+arguments[0])
    return this.Core.CommandSender.requestCommand(cmd).catch(() => {});
  }
  get Players() {
    return this.Core.Players;
  }
  async tellraw(Dest, Json) {
    if (!this.Players.length) {
      this.PluginLog("无玩家在线，忽略Tellraw");
    }
    if (this.newVersion && !/@/.test(Dest)) {
      Dest = `@e[name="${Dest}",type=minecraft:player]`;
    }
    let startWith = `tellraw ${Dest} `;
    Json.unshift({ text: `[${this.constructor.PluginName}]`, color: "green", bold: true });
    await this.CommandSender(startWith + JSON.stringify(Json));
  }
  async getAllScore() {
    let Score = this.Core.PluginInterfaces.get("Scoreboard").Scores;
    let NewScore = {};
    for (let [Player, ScoreList] of Object.entries(Score)) {
      NewScore[Player] = {};
      for (let [ScoreName, Score] of Object.entries(ScoreList)) {
        if (ScoreName.substring(0, 4) == this.Scoreboard_Prefix.substring(0, 4)) {
          NewScore[Player][ScoreName.substring(5)] = Score;
        }
      }
    }
    return NewScore;
  }
  async updateBackPositionDatabase(PlayerName) {
    if (this.Core.PluginInterfaces.has("Back")) {
      return this.Core.PluginInterfaces.get("Back").updateBackPositionDatabase(PlayerName);
    } else {
      return false;
    }
  }
  get MSPT() {
    if (this.Core.PluginInterfaces.has("Status")) {
      return this.Core.PluginInterfaces.get("Status").MSPT;
    } else {
      return 25;
    }
  }
  get Health() {
    if (this.Core.PluginInterfaces.has("PlayerHealth")) {
      let PlayerHealthInterface = this.Core.PluginInterfaces.get("PlayerHealth");
      return {
        async updateHealth(PlayerName) {
          return PlayerHealthInterface.updateHealth(PlayerName);
        },
        async HealthList() {
          return PlayerHealthInterface.HealthList();
        },
        async getHealthPlayer(PlayerName) {
          return PlayerHealthInterface.getHealthPlayer(PlayerName);
        }
      };
    } else {
      return {
        updateHealth: Promise.resolve(true),
        HealthList: async () => {
          return [];
        },
        getHealthPlayer: Promise.resolve(20)
      };
    }
  }
  async getScoreByPlayer(Player) {
    return (await this.getAllScore())[Player];
  }
  async getScoreByName(Name) {
    let Score = await this.getAllScore();
    let NewScore = {};
    for (let [Player, ScoreList] of Object.entries(Score)) {
      for (let [ScoreName, Score] of Object.entries(ScoreList)) {
        if (ScoreName == Name) {
          NewScore[Player] = Score;
        }
      }
    }
    return NewScore;
  }
  get Scoreboard() {
    if (!this._Scoreboard) {
      this._Scoreboard = {};
      for (let [name, Func] of Object.entries(this.Core.Scoreboard)) {
        this._Scoreboard[name] = (...arg) => {
          return Func(this, ...arg);
        };
      }
    }
    return this._Scoreboard;
  }
  get newVersion() {
    return this.Core.options.newVersion || false;
  }
}
module.exports = BasePlugin;
