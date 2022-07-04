const crypto = require("crypto");
const fs = require("fs");
const uuid = require("uuid").stringify;
let uuidCache = {};
class BasePlugin {
  constructor(Core) {
    this.Core = Core;
    const hash = crypto.createHash("sha1");
    this.Scoreboard_Prefix = hash.update(this.constructor.name).digest("hex");
  }
  PluginLog(t) {
    console.log(`[${this.constructor.PluginName}]` + t);
  }
  getWorldName(a) {
    if (typeof Number(a) == "number" && !isNaN(Number(a))) {
      a = this.Core.WorldMapping.id[a];
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
    if (uuidCache[Player]) return uuidCache[Player];
    if (this.newVersion) {
      uuidCache[Player] = this.ConvertUUID(
        await this.CommandSender(
          this.newVersion ? `data get entity @e[type="minecraft:player",limit=1,name="${Player}"] UUID` : "; 0,0,0,0"
        )
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
  async CommandSender() {
    // this.PluginLog(`[${new Date().getTime()}]执行命令:`+arguments[0])
    return this.Core.RconClient.send(...arguments).catch(this.Core.ErrorHandle.bind(this.Core));
  }
  async tellraw(Dest, Json) {
    if (this.newVersion && !/@/.test(Dest)) {
      Dest = `@e[name="${Dest}",type=minecraft:player]`;
    }
    let startWith = `tellraw ${Dest} `;
    let newJson = [[]];
    for (let Item of Json) {
      if (/^\n/.test(Item.text) && /\n$/.test(Item.text)) {
        Item.text = Item.text.toString().replace(/^\n/, "");
        newJson.push([Item]);
      } else if (/\n$/.test(Item.text)) {
        Item.text = Item.text.toString().replace(/\n$/, "");
        newJson[newJson.length - 1].push(Item);
        newJson.push([]);
      } else if (/^\n/.test(Item.text)) {
        Item.text = Item.text.toString().replace(/^\n/, "");
        newJson.push([Item]);
      } else if (Item instanceof Array) {
        for (let it of Item) {
          if (/^\n/.test(it.text) && /\n$/.test(it.text)) {
            it.text = it.text.toString().replace(/^\n/, "");
            newJson.push([it]);
          } else if (/\n$/.test(it.text)) {
            it.text = it.text.toString().replace(/\n$/, "");
            newJson[newJson.length - 1].push(it);
            newJson.push([]);
          } else if (/^\n/.test(it.text)) {
            it.text = it.text.toString().replace(/^\n/, "");
            newJson.push([it]);
          } else {
            it.text = it.text.toString();
            newJson[newJson.length - 1].push(it);
          }
        }
      } else {
        Item.text = Item.text.toString();
        newJson[newJson.length - 1].push(Item);
      }
    }
    for (let msg of newJson) {
      msg.unshift({ text: `[${this.constructor.PluginName}]`, color: "green", bold: true });
      await this.CommandSender(startWith + JSON.stringify(msg));
    }
  }
  async getAllScore() {
    let Score = this.Core.PluginInterfaces.get("Scoreboard").Scores;
    let NewScore = {};
    for (let [Player, ScoreList] of Object.entries(Score)) {
      NewScore[Player] = {};
      for (let [ScoreName, Score] of Object.entries(ScoreList)) {
        if (ScoreName.substring(0, 4) == this.Scoreboard_Prefix.substr(0, 4)) {
          NewScore[Player][ScoreName.substring(5)] = Score;
        }
      }
    }
    return NewScore;
  }
  async updateScore() {
    return this.Core.Scoreboard.updateScore(this);
  }
  async getScoreByPlayer(Player) {
    return (await this.getAllScore())[Player];
  }
  async getScoreByName(Name) {
    let Score = await this.getAllScore();
    let NewScore = {};
    for (let [Player, ScoreList] of Object.entries(Score)) {
      for (let [ScoreName, Score] of Object.entries(ScoreList)) {
        console;
        if (ScoreName == Name) {
          NewScore[Player] = Score;
        }
      }
    }
    return NewScore;
  }
  get Scoreboard() {
    let Mapping = {};
    for (let [name, Func] of Object.entries(this.Core.Scoreboard)) {
      Mapping[name] = (...arg) => {
        return Func(...arg, this);
      };
    }
    return Mapping;
  }
  get newVersion() {
    return this.Core.options.newVersion || false;
  }
}
module.exports = BasePlugin;
