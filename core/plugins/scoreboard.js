let BasePlugin = require(__dirname + "/../basePlugin.js");
const crypto = require("crypto");
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
    this.Core.Scoreboard = {
      ensureScoreboard: async (options, scope) => {
        await this.waitForSync;
        if (!options.displayname) {
          options.displayname = options.name;
        }
        options.name = this.getRealname(options.name, scope);
        if (!this.BoardList[options.name]) {
          console.log(
            `${scope.constructor.PluginName} 注册了一个名为 ${options.displayname} 的 ${options.type} 记分板`
          );
          return this.CommandSender(
            `scoreboard objectives add ${options.name} ${options.type} ${options.displayname}`
          ).then(a => {
            this.BoardList[options.name] = { name: options.name, displayname: options.displayname, type: options.type };
          });
        }
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
    return hash.update(scope.constructor.name).digest("hex").substr(0, 4) + "_" + name;
  }
  Start() {
    // 同步记分版列表
    this.CommandSender(`scoreboard objectives list`)
      .then(r => {
        let regexp = /- (\w+?):.displays as '(.*?)' and is type '(.*?)'/g;
        let item;
        while ((item = regexp.exec(r))) {
          let [_unuse, name, displayname, type] = item;
          this.BoardList[name] = { name, displayname, type };
        }
        return this.updateScore();
      })
      .then(() => {
        console.log("[记分板]同步完成");
        this.Synced();
      });
  }
  async updateScore() {
    return this.CommandSender(`scoreboard players list *`).then(r => {
      r = r.replace(/Player \w+ has no scores recorded/g, "");
      let regexp = /Showing \d+ tracked objective\(s\) for (\w+):(.*?)(?=Showing|$)/g;
      let player;
      while ((player = regexp.exec(r))) {
        let [_unuse, playername, scoreitem] = player;
        this.Scores[playername] = {};
        let subregexp = /- .+?: (\d+) \((\w+)\)/g;
        let item;
        // console.log(scoreitem)
        while ((item = subregexp.exec(scoreitem))) {
          let [__unuse, score, name] = item;
          this.Scores[playername][name] = Number(score);
        }
      }
    });
  }
}
module.exports = Scoreboard;
