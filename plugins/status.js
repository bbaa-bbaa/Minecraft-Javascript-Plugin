let BasePlugin = require("../core/basePlugin.js");
const si = require("systeminformation");
const { DateTime } = require("luxon");
const os = require("os");
const fs = require("fs");
class CPUInfo {
  constructor() {
    this.temperature = 0;
    this.speed = 0;
    this.load = 0;
  }
}
class Status extends BasePlugin {
  static PluginName = "监控系统";
  constructor() {
    super(...arguments);
    this.Info = { cpu: [], network: { interface: "" } };
    this.Intervals = {
      monitor: 0,
      system: 0
    };
    this._LastMspt = [];
    this.LastBroadcast = 0;
  }
  get MSPT() {
    return this._LastMspt[this._LastMspt.length - 1];
  }
  init(Plugin) {
    Plugin.registerCommand("status", () => {
      this.status();
    });
    Plugin.registerNativeLogProcesser(/\[Server thread\/INFO\].*?\<.*?\>\s([+-\d]+)\s*$/, log => {
      try {
        let Num = Number(log.match(/\[Server thread\/INFO\].*?\<.*?\>\s([+-\d]+)\s*$/)[1]);
        this.CommandSender(`me ${Num + 1}`);
      } catch (e) {}
    });
  }
  async getMinecraftLoad() {
    let statustext = await this.CommandSender("forge tps");
    let re = this.newVersion
      ? /(?:Dim )?(.*?)[ ]?(?:\(.*?\))?: Mean tick time:.(.*?).ms.*?TPS:.(.{6})/g
      : /.*?(\(.*?\)|Overall).:.*?tick time:.(.*?).ms.*?TPS:.(.{6})/g;
    let worldStatus;
    let MinecraftLoad = {};
    while ((worldStatus = re.exec(statustext))) {
      let [Source, World, MSPT, TPS] = worldStatus;
      World = this.newVersion ? World : World.replace(/[\(\)]/g, "");
      MSPT = Number(MSPT);
      TPS = Math.min(20, 1000 / MSPT).toFixed(2);
      MinecraftLoad[World] = { World, MSPT, TPS };
    }
    return MinecraftLoad;
  }
  static leastsquares(series) {
    let xAvg = (1 + series.length) / 2;
    let yAvg = series.reduce((a, b) => a + b) / series.length;
    let xySum = 0;
    let xSquareSum = 0;
    for (let [x, y] of series.entries()) {
      xySum += (x + 1) * y;
      xSquareSum += Math.pow(x + 1, 2);
    }
    return (xySum - series.length * xAvg * yAvg) / (xSquareSum - series.length * Math.pow(xAvg, 2));
  }
  async monitor() {
    if (this._LastMspt.length == 4) {
      this._LastMspt.shift();
    }
    let MinecraftLoad = await this.getMinecraftLoad();
    if (!MinecraftLoad["Overall"]) return;
    this._LastMspt.push(MinecraftLoad["Overall"].MSPT);
    let K = Status.leastsquares(this._LastMspt);
    this.PluginLog(`负载异动:${K} MSPT:${this.MSPT} TPS:${MinecraftLoad["Overall"].TPS}`);
    this.PluginLog(`LastMSPT: ${this._LastMspt.join(", ")} LastBoardcast:${this.LastBroadcast}`);
    if (Math.abs(K) > 2.0) {
      if (Math.abs(Math.max(...this._LastMspt) - Math.min(...this._LastMspt)) > 5) {
        if (K > 0 && Math.abs(Math.max(...this._LastMspt) - this.LastBroadcast) > 10) {
          this.LastBroadcast = Math.max(...this._LastMspt);
          this.tellraw(`@a`, [
            { text: `[${DateTime.now().toFormat("HH:mm")}]`, color: "yellow", bold: true },
            {
              text: `检测到服务器负载增加`,
              color: "red",
              bold: true
            }
          ]);
        } else if (K < 0 && Math.abs(Math.min(...this._LastMspt) - this.LastBroadcast) > 10) {
          this.LastBroadcast = Math.min(...this._LastMspt);
          this.tellraw(`@a`, [
            { text: `[${DateTime.now().toFormat("HH:mm")}]`, color: "yellow", bold: true },
            {
              text: `检测到服务器负载减少`,
              color: "green",
              bold: true
            }
          ]);
        } else {
          return;
        }
        let Color = MinecraftLoad["Overall"].TPS == 20 ? "green" : MinecraftLoad["Overall"].TPS > 15 ? "yellow" : "red";
        this.tellraw(`@a`, [
          { text: `世界:`, color: "aqua" },
          { text: this.getWorldName("Overall"), color: "green", bold: true },
          { text: ` TPS:`, color: "aqua" },
          { text: MinecraftLoad["Overall"].TPS, color: Color },
          { text: ` MSPT:`, color: "aqua" },
          { text: this.MSPT + "ms", color: Color },
          { text: ` 负载:`, color: "aqua" },
          { text: `${((this.MSPT / 50) * 100).toFixed(2)}%`, color: Color }
        ]);
      }
    }
  }
  async status() {
    this.tellraw("@a", [
      { text: "============= ", color: "yellow" },
      { text: "报告时间：", color: "green" },
      { text: DateTime.now().toFormat("HH:mm:ss"), color: "aqua", bold: true },
      { text: " =============", color: "yellow" }
    ]);
    this.tellraw("@a", [
      { text: "============= ", color: "yellow" },
      { text: "CPU", color: "pink" },
      { text: " =============", color: "yellow" }
    ]);
    for (let [idx, CPU] of this.Info.cpu.entries()) {
      let Blocks = Math.round(CPU.load / 10);
      this.tellraw("@a", [
        { text: `CPU #${idx} [`, color: "yellow" },
        { text: "■".repeat(Blocks), color: "yellow" },
        { text: "■".repeat(10 - Blocks), color: "green" },
        { text: `] `, color: "yellow" },
        {
          text: `${CPU.load.toFixed(2)}% `,
          color: CPU.load < 40 ? "green" : CPU.load < 70 ? "yellow" : "red"
        },
        {
          text: `${CPU.temperature}°C `,
          color: CPU.temperature < 40 ? "green" : CPU.temperature < 70 ? "yellow" : "red"
        },
        {
          text: `${Math.round(CPU.speed * 1000)} Mhz `,
          color: CPU.speed < 2.6 ? "green" : CPU.speed < 3.5 ? "yellow" : "red"
        }
      ]);
    }
    let CPUFan_RPM = Number(await fs.promises.readFile("/sys/class/hwmon/hwmon3/fan2_input"));
    this.tellraw("@a", [
      { text: `CPU Fan: `, color: "yellow" },
      { text: CPUFan_RPM.toString(), color: CPUFan_RPM < 833 ? "green" : CPUFan_RPM < 1167 ? "yellow" : "red" },
      { text: ` RPM`, color: "green" }
    ]);
    let Memory = await si.mem();
    this.tellraw("@a", [
      { text: "============= ", color: "yellow" },
      { text: "内存", color: "green" },
      { text: " =============", color: "yellow" }
    ]);
    this.tellraw("@a", [
      { text: "物理内存: ", color: "yellow" },
      {
        text: `${Math.round(Memory.used / 1024 / 1024)}`,
        color: Memory.used / Memory.total < 0.4 ? "green" : Memory.used / Memory.total < 0.7 ? "yellow" : "red"
      },
      { text: "/", color: "yellow" },
      { text: `${Math.floor(Memory.total / 1024 / 1024)} MB`, color: "yellow" }
    ]);
    this.tellraw("@a", [
      { text: "虚拟内存: ", color: "yellow" },
      {
        text: `${Math.round(Memory.swapused / 1024 / 1024)}`,
        color:
          Memory.swapused / Memory.swaptotal < 0.4
            ? "green"
            : Memory.swapused / Memory.swaptotal < 0.7
            ? "yellow"
            : "red"
      },
      { text: "/", color: "yellow" },
      { text: `${Math.floor(Memory.swaptotal / 1024 / 1024)} MB`, color: "yellow" }
    ]);
    this.tellraw("@a", [
      { text: "============= ", color: "yellow" },
      { text: "网络", color: "green" },
      { text: `${(this.Info.network.rx / 1024).toFixed(2)}KB/s↓   `, color: "green" },
      { text: `${(this.Info.network.tx / 1024).toFixed(2)}KB/s↑`, color: "green" },
      { text: " =============", color: "yellow" }
    ]);
    this.tellraw("@a", [
      { text: "============= ", color: "yellow" },
      { text: "Minecraft", color: "green" },
      { text: " =============", color: "yellow" }
    ]);
    let MinecraftLoad = await this.getMinecraftLoad();
    for (let { World, TPS, MSPT } of Object.values(MinecraftLoad)) {
      if (MSPT < 0.5) continue;
      let Color = TPS == 20 ? "green" : TPS > 15 ? "yellow" : "red";
      this.tellraw(`@a`, [
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
  }
  async Start() {
    if (this.isForge) {
      this.Intervals.monitor = setInterval(() => {
        this.monitor();
      }, 2500);
    }
    this.Info.network.interface = await si.networkInterfaceDefault();
    this.Intervals.system = setInterval(async () => {
      si.networkStats(this.Info.network.interface).then(data => {
        this.Info.network.rx = data[0].rx_sec;
        this.Info.network.tx = data[0].tx_sec;
      });
      si.cpuTemperature().then(cpu => {
        for (let [idx, value] of cpu.cores.entries()) {
          if (!this.Info.cpu[idx * 2]) {
            this.Info.cpu[idx * 2] = new CPUInfo();
          }
          if (!this.Info.cpu[idx * 2 + 1]) {
            this.Info.cpu[idx * 2 + 1] = new CPUInfo();
          }
          this.Info.cpu[idx * 2].temperature = value;
          this.Info.cpu[idx * 2 + 1].temperature = value;
        }
      });
      si.cpuCurrentSpeed().then(cpu => {
        for (let [idx, value] of cpu.cores.entries()) {
          if (!this.Info.cpu[idx]) {
            this.Info.cpu[idx] = new CPUInfo();
          }
          this.Info.cpu[idx].speed = value;
        }
      });
      si.currentLoad().then(load => {
        for (let [idx, value] of load.cpus.entries()) {
          if (!this.Info.cpu[idx]) {
            this.Info.cpu[idx] = new CPUInfo();
          }
          this.Info.cpu[idx].load = value.load;
        }
      });
      //console.dir(this.Info);
    }, 1000);
  }
  Pause() {
    for (let id of Object.values(this.Intervals)) {
      clearInterval(id);
    }
  }
}
module.exports = Status;
