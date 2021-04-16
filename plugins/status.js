let BasePlugin = require("../core/basePlugin.js");
const si = require("systeminformation");
const cpu = require("cpu");
const moment = require("moment");
let WorldMapping = {
  overworld: "主世界",
  Overall: "所有",
  the_nether: "地狱",
  the_end: "末地",
  twilight_forest: "暮色森林"
};
class Status extends BasePlugin {
  static PluginName = "监控";
  constructor() {
    super(...arguments);
    this.Info = { cpu: {}, network: {} };
    this.LoopId = 0;
    this.LastMspt = 0;
    this.MSPTDiffCount = 0;
  }
  init(Plugin) {
    Plugin.registerCommand("status", () => {
      this.status(true);
    });

    setInterval(() => {
      si.networkStats("enp2s0").then(data => {
        this.Info.network.rx = data[0].rx_sec;
        this.Info.network.tx = data[0].tx_sec;
      });
      cpu.usage(cpus => {
        this.Info.cpu = cpus;
      });
    }, 1000);
  }
  async status(force = false) {
    //if (!this.RconClient.connected) return;
    this.CommandSender("forge tps")
      .then(async statustext => {
        if (force) {
          let Mem = await si.mem();
          this.CommandSender(
            `tellraw @a ${JSON.stringify([
              { text: "[监控系统]", color: "green", bold: true },
              { text: `[${moment().format("HH:mm")}]`, color: "yellow", bold: true },
              ...this.Info.cpu.map((cpu, idx) => {
                return [
                  { text: `CPU#${idx}:`, color: "aqua" },
                  { text: `${cpu}% `, color: Number(cpu) < 40 ? "green" : Number(cpu) < 60 ? "yellow" : "red" }
                ];
              })
            ])}`
          );
          this.CommandSender(
            `tellraw @a ${JSON.stringify([
              { text: "[监控系统]", color: "green", bold: true },
              { text: `[${moment().format("HH:mm")}]`, color: "yellow", bold: true },
              { text: `物理内存使用:`, color: "aqua" },
              {
                text: `${(Mem.active / 1024 / 1024).toFixed(2)}M/${(Mem.total / 1024 / 1024).toFixed(2)}M`,
                color: "green"
              }
            ])}`
          );
          this.CommandSender(
            `tellraw @a ${JSON.stringify([
              { text: "[监控系统]", color: "green", bold: true },
              { text: `[${moment().format("HH:mm")}]`, color: "yellow", bold: true },
              { text: `网络:  `, color: "aqua" },
              { text: `${(this.Info.network.rx / 1024).toFixed(2)}KB/s↓   `, color: "green" },
              { text: `${(this.Info.network.tx / 1024).toFixed(2)}KB/s↑`, color: "green" }
            ])}`
          );
        }
        let re = /.*?(\(.*?\)|Overall).:.*?tick time:.(.*?).ms.*?TPS:.(.{6})/g;
        //console.log(statustext,re.exec(statustext))
        let worldStatus;
        while ((worldStatus = re.exec(statustext))) {
          let [Source, World, MSPT, TPS] = worldStatus;
          World = World.replace(/[\(\)]/g, "");
          MSPT = Number(MSPT);
          TPS = Math.min(20, 1000 / MSPT).toFixed(2);
          if (!force && World == "Overall") {
            let MSPTDiff = MSPT - this.LastMspt;
            if (this.LastMspt == 0) {
              this.LastMspt = MSPT;
              return;
            }
            if (Math.abs(MSPTDiff) < (TPS > 18 ? 8 : 5)) {
              return;
            }
            this.LastMspt = MSPT;
            if (MSPTDiff > 0) {
              this.MSPTDiffCount += MSPT > 40 ? 2 : 1;
            } else {
              this.MSPTDiffCount -= MSPT < 10 ? 2 : 1;
            }
            if (MSPTDiff != 0) {
              console.log(`负载异动:${this.MSPTDiffCount}`);
            }
            if (Math.abs(this.MSPTDiffCount) < 4) return;
            if (this.MSPTDiffCount >= (TPS > 18 ? 4 : 2)) {
              this.CommandSender(
                `tellraw @a ${JSON.stringify([
                  { text: "[监控系统]", color: "yellow", bold: true },
                  { text: `[${moment().format("HH:mm")}]`, color: "yellow", bold: true },
                  {
                    text: `检测到服务器负载增加`,
                    color: "red",
                    bold: true
                  }
                ])}`
              ).catch(() => {});
              this.MSPTDiffCount = 0;
            }
            if (this.MSPTDiffCount <= -(TPS < 18 ? 4 : 2)) {
              this.CommandSender(
                `tellraw @a ${JSON.stringify([
                  { text: "[监控系统]", color: "green", bold: true },
                  { text: `[${moment().format("HH:mm")}]`, color: "yellow", bold: true },
                  {
                    text: `检测到服务器负载减少`,
                    color: "green",
                    bold: true
                  }
                ])}`
              ).catch(() => {});
              this.MSPTDiffCount = 0;
            }
          } else if (!force) continue;
          if (MSPT < 0.5) continue;
          let Color = TPS == 20 ? "green" : TPS > 15 ? "yellow" : "red";
          this.CommandSender(
            `tellraw @a ${JSON.stringify([
              { text: `[${moment().format("HH:mm")}]`, color: "yellow", bold: true },
              { text: `世界:`, color: "aqua" },
              { text: WorldMapping[World] || World, color: "green", bold: true },
              { text: ` TPS:`, color: "aqua" },
              { text: TPS, color: Color },
              { text: ` MSPT:`, color: "aqua" },
              { text: MSPT + "ms", color: Color },
              { text: ` 负载:`, color: "aqua" },
              { text: `${((MSPT / 50) * 100).toFixed(2)}%`, color: Color }
            ])}`
          ).catch(() => {});
        }
      })
      .catch(() => {});
  }
  Start() {
    this.LoopId = setInterval(() => {
      this.status().catch(() => {});
    }, 3000);
  }
  Pause() {
    clearInterval(this.LoopId);
  }
}
module.exports = Status;
