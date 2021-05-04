let BasePlugin = require("../core/basePlugin.js");
const moment = require("moment");
const schedule = require("node-schedule");
const { clearInterval } = require("node:timers");
class ItemCleaner extends BasePlugin {
  static PluginName = "扫地大妈";
  constructor() {
    super(...arguments);
    this.CleanPending = {
      Pending: false,
      Timer: 0,
      StartTime: 0
    };
    //this.schedule={}
  }
  init(Plugin) {
    Plugin.registerCommand("itemclean", (p, ...a) => {
      console.log("itemcleanz " + a[0]);
      if (a[0] == "cancel" && this.CleanPending.Pending) {
        clearInterval(this.CleanPending.Timer);
        this.CleanPending.Pending = false;
        this.tellraw("@a", [
          { text: "[扫地大妈]", color: "green" },
          { text: "取消本次扫地 ", color: "aqua" }
        ]);
      }
      if (a[0] == "now") {
        this.Clean();
      }
      if (a[0] == "job") {
        this.startTimer();
      }
    });
  }
  Start() {
    this.schedule = schedule.scheduleJob("0 9,19,29,39,49,59 * * * *", async () => {
      this.startTimer();
    });
  }
  startTimer() {
    console.log("执行扫地计划");
    if (!this.CleanPending.Pending) {
      this.CleanPending.Pending = true;
      this.tellraw("@a", [
        { text: "[扫地大妈]", color: "green" },
        { text: "1分钟后清理垃圾 ", color: "aqua" },
        { text: "[点此取消]", color: "gold", clickEvent: { action: "run_command", value: `!!itemclean cancel` } }
      ]);
      this.CleanPending.StartTime = new Date().getTime();
      this.CleanPending.Timer = setInterval(() => {
        this.CleanTimer();
      }, 500);
    }
  }
  CleanTimer() {
    let d = new Date().getTime() - this.CleanPending.StartTime;
    let Sec = Math.floor(d/1000);
    if (Sec == 30) {
      this.tellraw("@a", [
        { text: "[扫地大妈]", color: "green" },
        { text: "30秒后清理垃圾 ", color: "aqua" },
        { text: "[点此取消]", color: "gold", clickEvent: { action: "run_command", value: `!!itemclean cancel` } }
      ]);
    }
    if (Sec == 50) {
      this.tellraw("@a", [
        { text: "[扫地大妈]", color: "green" },
        { text: "10秒后清理垃圾 ", color: "aqua" },
        { text: "[点此取消]", color: "gold", clickEvent: { action: "run_command", value: `!!itemclean cancel` } }
      ]);
    }
    if (Sec == 60) {
      clearInterval(this.CleanPending.Timer);
      this.CleanPending.Pending = false;
      this.Clean();
    }
  }
  async Clean() {
    console.log("进行扫地");
    this.tellraw("@a", [
      { text: "[扫地大妈]", color: "green" },
      { text: "正在清理", color: "aqua" }
    ]);
    this.CommandSender("kill @e[type=Item]").then(a => {
      let Count;
      Count = (Count = a.match(/Killed/g)) ? Count.length : 0;
      this.tellraw("@a", [
        { text: "[扫地大妈]", color: "green" },
        { text: "清理了", color: "aqua" },
        { text: Count, color: "yellow" },
        { text: "个垃圾", color: "aqua" }
      ]);
    });
  }
  Pause() {
    if (this.schedule && this.schedule.cancel) this.schedule.cancel();
    if (this.CleanPending.Pending) {
      clearInterval(this.CleanPending.Timer);
      this.CleanPending.Pending = false;
    }
  }
}
module.exports = ItemCleaner;
