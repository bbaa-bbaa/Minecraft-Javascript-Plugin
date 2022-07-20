let BasePlugin = require("../core/basePlugin.js");
const si = require("systeminformation");
const cpu = require("cpu");
const moment = require("moment");
const os = require("os");
class Status extends BasePlugin {
  static PluginName = "监控系统";
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
    Plugin.registerNativeLogProcesser(/\[Server thread\/INFO\].*?\<.*?\>\s([+-\d]+)\s*$/, log => {
      try {
        let Num = Number(log.match(/\[Server thread\/INFO\].*?\<.*?\>\s([+-\d]+)\s*$/)[1]);
        this.CommandSender(`me ${Num + 1}`);
      } catch (e) { }
    });
    setInterval(async () => {
      si.networkStats(await si.networkInterfaceDefault()).then(data => {
        this.Info.network.rx = data[0].rx_sec;
        this.Info.network.tx = data[0].tx_sec;
      });
      cpu.usage(cpus => {
        this.Info.cpu = cpus;
      });
    }, 1000);
  }
  async status(force = false) {
    if (force) {
      let Mem = await si.mem();
      this.tellraw(`@a`, [
        { text: `[${moment().format("HH:mm")}]`, color: "yellow", bold: true },
        ...this.Info.cpu.map((cpu, idx) => {
          return [
            { text: `CPU#${idx}:`, color: "aqua" },
            { text: `${cpu}% `, color: Number(cpu) < 40 ? "green" : Number(cpu) < 60 ? "yellow" : "red" }
          ];
        })
      ]);
      this.tellraw(`@a`, [
        { text: `[${moment().format("HH:mm")}]`, color: "yellow", bold: true },
        ...os.loadavg().map((la, idx) => {
          la = la.toFixed(2);
          return [
            { text: `Loadavg#${["1min", "5min", "15min"][idx]}:`, color: "aqua" },
            {
              text: `${la} `,
              color:
                Number(la / this.Info.cpu.length) < 0.4
                  ? "green"
                  : Number(la / this.Info.cpu.length) < 0.6
                    ? "yellow"
                    : "red"
            }
          ];
        })
      ]);
      this.tellraw(`@a`, [
        { text: `[${moment().format("HH:mm")}]`, color: "yellow", bold: true },
        { text: `物理内存使用:`, color: "aqua" },
        {
          text: `${(Mem.active / 1024 / 1024).toFixed(2)}M/${(Mem.total / 1024 / 1024).toFixed(2)}M`,
          color: "green"
        }
      ]);
      this.tellraw(`@a`, [
        { text: `[${moment().format("HH:mm")}]`, color: "yellow", bold: true },
        { text: `虚拟内存使用:`, color: "aqua" },
        {
          text: `${(Mem.swapused / 1024 / 1024).toFixed(2)}M/${(Mem.swaptotal / 1024 / 1024).toFixed(2)}M`,
          color: "green"
        }
      ]);
      this.tellraw(`@a`, [
        { text: `[${moment().format("HH:mm")}]`, color: "yellow", bold: true },
        { text: `网络:  `, color: "aqua" },
        { text: `${(this.Info.network.rx / 1024).toFixed(2)}KB/s↓   `, color: "green" },
        { text: `${(this.Info.network.tx / 1024).toFixed(2)}KB/s↑`, color: "green" }
      ]);
    }
    if(!this.isForge) return
    this.CommandSender("forge tps")
      .then(async statustext => {
        let re = this.newVersion ? /(?:Dim | )+(.*?)[ ]?(?:\(.*?\))?: Mean tick time:.(.*?).ms.*?TPS:.(.{6})/g : /.*?(\(.*?\)|Overall).:.*?tick time:.(.*?).ms.*?TPS:.(.{6})/g;
        let worldStatus;
        while ((worldStatus = re.exec(statustext))) {
          let [Source, World, MSPT, TPS] = worldStatus;
          console.log(World, MSPT, TPS)
          World = this.newVersion ? World : World.replace(/[\(\)]/g, "");
          MSPT = Number(MSPT);
          TPS = Math.min(20, 1000 / MSPT).toFixed(2);
          if (!force && World == "Overall") {
            let MSPTDiff = MSPT - this.LastMspt;
            if (this.LastMspt == 0) {
              this.LastMspt = MSPT;
              return;
            }
            this.LastMspt = MSPT;
            if (MSPTDiff != 0) {
              this.MSPTDiffCount += Math.round(MSPTDiff / 5);
            }
            if (Math.abs(MSPTDiff) > 5) {
              this.PluginLog(`负载异动:${this.MSPTDiffCount} MSPT:${MSPT}`);
            }
            if (this.MSPTDiffCount >= 6) {
              this.tellraw(`@a`, [
                { text: `[${moment().format("HH:mm")}]`, color: "yellow", bold: true },
                {
                  text: `检测到服务器负载增加`,
                  color: "red",
                  bold: true
                }
              ]);
              this.MSPTDiffCount = 0;
            } else if (this.MSPTDiffCount <= -6) {
              this.tellraw(`@a`, [
                { text: `[${moment().format("HH:mm")}]`, color: "yellow", bold: true },
                {
                  text: `检测到服务器负载减少`,
                  color: "green",
                  bold: true
                }
              ]);
              this.MSPTDiffCount = 0;
            } else {
              return;
            }
          } else if (!force) continue;
          if (MSPT < 0.5) continue;
          let Color = TPS == 20 ? "green" : TPS > 15 ? "yellow" : "red";
          this.tellraw(`@a`, [
            { text: `[${moment().format("HH:mm")}]`, color: "yellow", bold: true },
            { text: `世界:`, color: "aqua" },
            { text: this.getWorldName(World), color: "green", bold: true },
            { text: ` TPS:`, color: "aqua" },
            { text: TPS, color: Color },
            { text: ` MSPT:`, color: "aqua" },
            { text: MSPT + "ms", color: Color },
            { text: ` 负载:`, color: "aqua" },
            { text: `${((MSPT / 50) * 100).toFixed(2)}%`, color: Color }
          ]);
        }
      })
      .catch(() => { });
  }
  Start() {
    if (this.isForge) {
      this.LoopId = setInterval(() => {
        this.status();
      }, 5000);
    }
  }
  Pause() {
    clearInterval(this.LoopId);
  }
}
module.exports = Status;
