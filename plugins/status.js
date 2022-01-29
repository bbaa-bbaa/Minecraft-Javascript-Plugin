let BasePlugin = require("../core/basePlugin.js");
const si = require("systeminformation");
const cpu = require("cpu");
const moment = require("moment");
const os = require('os');
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
    Plugin.registerNativeLogProcesser(/\[Server thread\/INFO\].*?\<.*?\>\s([+-\d]+)\s*$/, (log) => {
      try {
        let Num = Number(log.match(/\[Server thread\/INFO\].*?\<.*?\>\s([+-\d]+)\s*$/)[1]);
        this.CommandSender(`me ${Num + 1}`)
      } catch (e) { }
    })
    setInterval(() => {
      si.networkStats("ens5").then(data => {
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
    this.CommandSender(`tellraw @a ${JSON.stringify([
      { text: "[监控系统]", color: "green", bold: true },
      { text: `[${moment().format("HH:mm")}]`, color: "yellow", bold: true },
      ...os.loadavg().map((la, idx) => {
        la=la.toFixed(2)
        return [
          { text: `Loadavg#${["1min","5min","15min"][idx]}:`, color: "aqua" },
          { text: `${la} `, color: Number(la) < 0.4 ? "green" : Number(la) < 0.6 ? "yellow" : "red" }
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
  Start() {
  }
  Pause() {
 //   clearInterval(this.LoopId);
  }
}
module.exports = Status;
