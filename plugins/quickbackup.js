let BasePlugin = require("../core/basePlugin.js");
const fs = require("fs-extra");
const cp = require("child_process");
const moment = require("moment");
const util = require("util");
const schedule = require("node-schedule");
const runCommand = util.promisify(cp.exec);
const klawSync = require("klaw-sync");
class QuickBackup extends BasePlugin {
  static PluginName = "快速备份";
  constructor() {
    super(...arguments);
    this.schedule = null;
  }
  init(Plugin) {
    Plugin.registerCommand("qb", this.Cli);
    this.Core.EventBus.on("playerlistchange",(List)=>{
      if(List == 0){
        this.RunBackup(`自动备份-玩家离开-${moment().format("YY-MM-DD-HH-mm-ss")}`);
      }
    })
  }
  async Cli(Player, ...args) {
    let SubCommand = args[0];
    let List = [];
    switch (SubCommand) {
      case "list":
        List = await fs.promises.readdir("/media/XiaoMi/mcSave");
        let Texts = [
          { text: `服务器上目前有`, color: "yellow" },
          { text: List.length, color: "aqua" },
          { text: `个备份文件\n`, color: "yellow" }
        ];
        for (let [idx, Item] of List.entries()) {
          Texts.push(
            { text: `${idx + 1}.`, color: "aqua" },
            { text: Item.split(".").shift() + (idx !== List.length - 1 ? "\n" : ""), color: "yellow" }
          );
        }
        await this.CommandSender(`tellraw @a ${JSON.stringify(Texts)}`);
        break;
      case "make":
        let comment = args[1];
        if (comment) {
          await this.RunBackup(comment);
        } else {
          await this.CommandSender(
            `tellraw @a ${JSON.stringify([
              { text: "[自动备份系统]", color: "green", bold: true },
              { text: `命令格式:`, color: "yellow", bold: true },
              { text: "!!qb", color: "yellow" },
              { text: " make ", color: "aqua" },
              { text: "<备注信息>", color: "red" }
            ])}`
          );
        }
      case "help":
        break;
      case "back":
        break;
      case "confirm":
        break;
    }
  }
  async RunBackup(comment) {
    comment = comment.replace(/(["\s'$`\\])/g, "\\$1");
    console.log(`[${moment().format("HH:mm:ss")}]运行备份 备注:${comment}`)
    let FileName = `${comment}.tar.gz`;
    let Path = `/tmp/Minecraft/${FileName}`;
    await this.CommandSender(
      `tellraw @a ${JSON.stringify([
        { text: "[自动备份系统]", color: "green", bold: true },
        { text: `[${moment().format("HH:mm:ss")}]`, color: "yellow", bold: true },
        { text: "服务器正在备份...", color: "yellow" }
      ])}`
    );
    await this.CommandSender(
      `tellraw @a ${JSON.stringify([
        { text: "[自动备份系统]", color: "green", bold: true },
        { text: `[${moment().format("HH:mm:ss")}]`, color: "yellow", bold: true },
        { text: "正在保存存档 ", color: "yellow" },
        { text: "请勿快速移动", color: "red" }
      ])}`
    );
    await this.CommandSender("save-all");
    await this.CommandSender(
      `tellraw @a ${JSON.stringify([
        { text: "[自动备份系统]", color: "green", bold: true },
        { text: `[${moment().format("HH:mm:ss")}]`, color: "yellow", bold: true },
        { text: "存档保存成功", color: "green" }
      ])}`
    );
    await this.CommandSender(
      `tellraw @a ${JSON.stringify([
        { text: "[自动备份系统]", color: "green", bold: true },
        { text: `[${moment().format("HH:mm:ss")}]`, color: "yellow", bold: true },
        { text: "正在打包存档", color: "yellow" }
      ])}`
    );
    await fs.ensureDir("/tmp/Minecraft/world");
    let CleanList = fs.readdirSync("/tmp/Minecraft").filter(a => /tar\.gz/.test(a));
    for (let Item of CleanList) {
      await fs.promises.unlink("/tmp/Minecraft/" + Item);
    }
    await fs.emptyDir("/tmp/Minecraft/world");
    await fs.copy("/home/bbaa/FOA/world", "/tmp/Minecraft/world");
    let a = await runCommand(`tar -cvzf ../${FileName} *`, { cwd: "/tmp/Minecraft/world" });
    let Stat = fs.statSync(Path);
    let Size = Stat.size / 1048576;
    await this.CommandSender(
      `tellraw @a ${JSON.stringify([
        { text: "[自动备份系统]", color: "green", bold: true },
        { text: `[${moment().format("HH:mm:ss")}]`, color: "yellow", bold: true },
        { text: "存档打包完成 存档大小:", color: "green" },
        { text: `${Size.toFixed(2)}M`, color: "yellow", bold: true }
      ])}`
    );
    await this.CommandSender(
      `tellraw @a ${JSON.stringify([
        { text: "[自动备份系统]", color: "green", bold: true },
        { text: `[${moment().format("HH:mm:ss")}]`, color: "yellow", bold: true },
        { text: "正在上传存档到备份服务器", color: "yellow" }
      ])}`
    );
    await fs.move(Path, `/media/XiaoMi/mcSave/${FileName}`);
    await this.CommandSender(
      `tellraw @a ${JSON.stringify([
        { text: "[自动备份系统]", color: "green", bold: true },
        { text: `[${moment().format("HH:mm:ss")}]`, color: "yellow", bold: true },
        { text: "存档上传成功", color: "green" }
      ])}`
    );

    await this.CommandSender(
      `tellraw @a ${JSON.stringify([
        { text: "[自动备份系统]", color: "green", bold: true },
        { text: `[${moment().format("HH:mm:ss")}]`, color: "yellow", bold: true },
        { text: "备份进程结束", color: "yellow" }
      ])}`
    );
  }
  Start() {
    this.schedule = schedule.scheduleJob("0 0,30 * * * *", async () => {
      if (this.Core.Players.length) {
        let ServerFile = klawSync("/media/XiaoMi/mcSave", {
          nodir: true
        });
        for (let File of ServerFile) {
          if (new Date().getTime() - File.mtimeMs > 86400000 && /\\自动备份-/.test(File.path)) {
            await fs.unlink(File.path);
          }
        }
        this.RunBackup(`自动备份-${moment().format("YY-MM-DD-HH-mm-ss")}`).then(() => {
          return this.CommandSender(
            `tellraw @a ${JSON.stringify([
              { text: "[自动备份系统]", color: "green", bold: true },
              { text: `如果你正在进行大型项目的建设，可通过命令:\n`, color: "gold", bold: true },
              { text: "!!qb", color: "yellow" },
              { text: " make ", color: "aqua" },
              { text: "<备注信息>", color: "red" },
              { text: "\n来进行存档的备份", color: "aqua" }
            ])}`
          );
        });
      }
    });
    
    return this.CommandSender(
      `tellraw @a ${JSON.stringify([
        { text: "[自动备份系统]", color: "green", bold: true },
        { text: `如果你正在进行大型项目的建设，可通过命令:\n`, color: "gold", bold: true },
        { text: "!!qb", color: "yellow" },
        { text: " make ", color: "aqua" },
        { text: "<备注信息>", color: "red" },
        { text: "\n来进行存档的备份", color: "aqua" }
      ])}`
    );
  }
  Pause() {
    this.schedule.cancel();
  }
}
module.exports = QuickBackup;
