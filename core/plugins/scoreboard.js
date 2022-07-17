let BasePlugin = require(__dirname + "/../basePlugin.js");
const crypto = require("crypto");
const _ = require("lodash");
class Scoreboard extends BasePlugin {
  static PluginName = "记分版";
  constructor() {
    super(...arguments);
    this.waitForSync = new Promise(r => {
      this.Synced = r;
    });
    this.BoardList = {}; // name,type,displayname,pluginhash
    this.Scores = {};
  }
  init(Plugin) {
    let requestUpdateScore = _.debounce(() => {
      this.updateScore().then(() => {
        this.Synced();
      });
    }, 1000);
    this.Core.Scoreboard = {
      ensureScoreboard: async (options, scope) => {
        if (!this.newVersion) await this.waitForSync;
        if (!options.displayname) {
          options.displayname = options.name;
        }
        options.name = this.getRealname(options.name, scope);
        if (!this.BoardList[options.name]) {
          this.PluginLog(
            `${scope.constructor.PluginName} 注册了一个名为 ${options.displayname} 的 ${options.type} 记分板`
          );
          return this.CommandSender(
            `scoreboard objectives add ${options.name} ${options.type} ${
              this.newVersion ? '"' + options.displayname + '"' : options.displayname
            }`
          ).then(a => {
            if (this.newVersion) requestUpdateScore();
            this.BoardList[options.name] = { name: options.name, displayname: options.displayname, type: options.type };
          });
        }
        if (this.newVersion) requestUpdateScore();
        return Promise.resolve();
      },
      displayScoreboard: async (name, type, scope) => {
        await this.waitForSync;
        name = this.getRealname(name, scope);
        return this.CommandSender(`scoreboard objectives setdisplay ${type} ${name}`);
      },
      updateScore: async scope => {
        return this.updateScore();
      },
      playerAction: async (Player, action, name, count, scope) => {
        await this.waitForSync;
        name = this.getRealname(name, scope);
        return this.CommandSender(`scoreboard players ${action} ${Player} ${name} ${count}`);
      }
    };
  }
  getRealname(name, scope) {
    const hash = crypto.createHash("sha1");
    return hash.update(scope.constructor.name).digest("hex").substring(0, 4) + "_" + name;
  }
  Start() {
    if (!this.newVersion) {
      this.CommandSender(`scoreboard objectives list`)
        .then(r => {
          r=r.replace(/\n/g,"")
          let regexp = /- (\w+?):.displays as '(.*?)' and is type '(.*?)'/g;
          let item;
          while ((item = regexp.exec(r))) {
            let [_unuse, name, displayname, type] = item;
            this.BoardList[name] = { name, displayname, type };
          }
          return this.updateScore();
        })
        .then(() => {
          this.PluginLog(`同步完成`);
          this.Synced();
        });
    }
  }
  async updateScore() {
    if (!this.newVersion) {
      return this.CommandSender(`scoreboard players list *`).then(r => {
        r = r.replace(/Player \w+ has no scores recorded/g, "");
        let regexp = /Showing \d+ tracked objective\(s\) for (\w+):(.*?)(?=Showing|$)/g;
        let player;
        while ((player = regexp.exec(r))) {
          let [_unuse, playername, scoreitem] = player;
          this.Scores[playername] = {};
          let subregexp = /- .+?: (\d+) \((\w+)\)/g;
          let item;
          while ((item = subregexp.exec(scoreitem))) {
            let [__unuse, score, name] = item;
            this.Scores[playername][name] = Number(score);
          }
        }
      });
    } else {
      this.PluginLog(`新版MC记分板备用同步方案,记录的记分板列表如下`);
      const ScoreList = Object.keys(this.BoardList);
      console.log(ScoreList);
      this.PluginLog(`获取被跟踪的实体列表`);
      return this.CommandSender("scoreboard players list").then(async a => {
        if (!/There are \d tracked entities:\s?(.*)/.test(a)) return Promise.resolve();
        let players = a
          .match(/There are \d tracked entities:\s?(.*)/)[1]
          .split(",")
          .map(b => b.trim());
        for (let i of players) {
          this.Scores[i] = {};
          for (let s of ScoreList) {
            this.PluginLog(`正在获取玩家:${i} 的 ${s} 记分项`);
            await this.CommandSender(`scoreboard players get ${i} ${s}`).then(c => {
              if (!/^.*? has (\d+)/.test(c)) return Promise.resolve();
              let score = Number(c.match(/^.*? has (\d+)/)[1]);
              if (!isNaN(score)) {
                this.Scores[i][s] = score;
                this.PluginLog(`玩家:${i} 的 ${s} 记分项值为:${score}`);
              }
            });
          }
        }
        return Promise.resolve();
      });
    }
  }
}
module.exports = Scoreboard;
