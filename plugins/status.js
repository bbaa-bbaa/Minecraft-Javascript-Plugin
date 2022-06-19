let BasePlugin = require("../core/basePlugin.js");
const si = require("systeminformation");
const cpu = require("cpu");
const moment = require("moment");
const os = require("os");
let WorldMapping = {
  overworld: "主世界",
  Overall: "所有",
  vox_ponds: "未知",
  the_nether: "地狱",
  candyland: "糖果",
  deeplands: "深层",
  mysterium: "秘境",
  immortallis: "不朽",
  barathos: "爵士",
  lborean: "暴风",
  ancient_cavern: "远古神殿",
  the_end: "末地",
  runandor: "符境",
  crystevia: "晶体",
  gardencia: "花园",
  celeve: "玩具",
  lelyetia: "赫尔维蒂",
  precasia: "传说",
  iromine: "黄金",
  greckon: "格瑞克",
  creeponia: "蠕变",
  dustopia: "异位",
  shyrelands: "塞尔瑞",
  lunalus: "月球",
  haven: "天堂",
  abyss: "深渊"
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
    Plugin.registerNativeLogProcesser(/\[Server thread\/INFO\].*?\<.*?\>\s([+-\d]+)\s*$/, log => {
      try {
        let Num = Number(log.match(/\[Server thread\/INFO\].*?\<.*?\>\s([+-\d]+)\s*$/)[1]);
        this.CommandSender(`me ${Num + 1}`);
      } catch (e) {}
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
    let Mem = await si.mem();
    this.tellraw(`@a`, [
      { text: "[监控系统]", color: "green", bold: true },
      { text: `[${moment().format("HH:mm")}]`, color: "yellow", bold: true },
      ...this.Info.cpu.map((cpu, idx) => {
        return [
          { text: `CPU#${idx}:`, color: "aqua" },
          { text: `${cpu}% `, color: Number(cpu) < 40 ? "green" : Number(cpu) < 60 ? "yellow" : "red" }
        ];
      })
    ]);
    this.tellraw(`@a`, [
      { text: "[监控系统]", color: "green", bold: true },
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
      { text: "[监控系统]", color: "green", bold: true },
      { text: `[${moment().format("HH:mm")}]`, color: "yellow", bold: true },
      { text: `物理内存使用:`, color: "aqua" },
      {
        text: `${(Mem.active / 1024 / 1024).toFixed(2)}M/${(Mem.total / 1024 / 1024).toFixed(2)}M`,
        color: "green"
      }
    ]);
    this.tellraw(`@a`, [
      { text: "[监控系统]", color: "green", bold: true },
      { text: `[${moment().format("HH:mm")}]`, color: "yellow", bold: true },
      { text: `虚拟内存使用:`, color: "aqua" },
      {
        text: `${(Mem.swapused / 1024 / 1024).toFixed(2)}M/${(Mem.swaptotal / 1024 / 1024).toFixed(2)}M`,
        color: "green"
      }
    ]);
    this.tellraw(`@a`, [
      { text: "[监控系统]", color: "green", bold: true },
      { text: `[${moment().format("HH:mm")}]`, color: "yellow", bold: true },
      { text: `网络:  `, color: "aqua" },
      { text: `${(this.Info.network.rx / 1024).toFixed(2)}KB/s↓   `, color: "green" },
      { text: `${(this.Info.network.tx / 1024).toFixed(2)}KB/s↑`, color: "green" }
    ]);
    this.CommandSender("forge tps")
      .then(async statustext => {
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
            this.LastMspt = MSPT;
            if (MSPTDiff != 0) {
              this.MSPTDiffCount += Math.round(MSPTDiff / 5);
            }
            if (Math.abs(MSPTDiff) > 5) {
              console.log(`负载异动:${this.MSPTDiffCount} MSPT:${MSPT}`);
            }
            // if (Math.abs(this.MSPTDiffCount) < 4) return;
            if (this.MSPTDiffCount >= 6) {
              this.tellraw(`@a`, [
                { text: "[监控系统]", color: "yellow", bold: true },
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
                { text: "[监控系统]", color: "green", bold: true },
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
            { text: WorldMapping[World] || World, color: "green", bold: true },
            { text: ` TPS:`, color: "aqua" },
            { text: TPS, color: Color },
            { text: ` MSPT:`, color: "aqua" },
            { text: MSPT + "ms", color: Color },
            { text: ` 负载:`, color: "aqua" },
            { text: `${((MSPT / 50) * 100).toFixed(2)}%`, color: Color }
          ]);
        }
      })
      .catch(() => {});
  }
  Start() {}
  Pause() {
    //   clearInterval(this.LoopId);
  }
}
module.exports = Status;
