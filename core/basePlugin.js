const crypto = require("crypto");

class BasePlugin {
  constructor(Core) {
    this.Core = Core;
    const hash = crypto.createHash("sha1");
    this.Scoreboard_Prefix = hash.update(this.constructor.name).digest("hex");
  }
  CommandSender() {
    return this.Core.RconClient.send(...arguments).catch(this.Core.ErrorHandle);
  }
  async getAllScore() {
    let Score = this.Core.PluginInterfaces.Scoreboard.Scores;
    let NewScore = {};
    for (let [Player, ScoreList] of Object.entries(Score)) {
      NewScore[Player] = {};
      for (let [ScoreName, Score] of Object.entries(ScoreList)) {
        if (ScoreName.substr(0, 4) == this.Scoreboard_Prefix.substr(0, 4)) {
          NewScore[Player][ScoreName.substr(5)] = Score;
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
}
module.exports = BasePlugin;
