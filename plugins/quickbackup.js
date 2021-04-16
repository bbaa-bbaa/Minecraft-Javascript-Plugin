let BasePlugin = require("../core/basePlugin.js");
const fs = require("fs-extra");
const cp = require("child_process");
const moment = require("moment");
const util = require("util");
const schedule = require("node-schedule");
const runCommand = util.promisify(cp.exec);
const klawSync = require("klaw-sync");
const path = require("path");
class QuickBackup extends BasePlugin {
  static PluginName = "快速备份";
  constructor() {
    super(...arguments);
    this.schedule = null;
    this.backupDest = "/media/XiaoMi/mcSave";
    this.SaveSource = `${this.Core.BaseDir}/world`;
    this.RunServer = `${this.Core.BaseDir}/runserver`;
    this.backPending = {
      Timer: 0,
      choice: "",
      waitLoop: 0,
      waitCount: 0
    };
    this.deletePending = {
      choice: ""
    };
    this.Pending = "";
  }
  init(Plugin) {
    Plugin.registerCommand("qb", this.Cli);
    this.Core.EventBus.on("playerlistchange", List => {
      if (List == 0) {
        this.RunBackup(`自动备份-玩家离开-${moment().format("YY-MM-DD-HH-mm-ss")}`);
      }
    });
  }
  async Cli(Player, ...args) {
    let SubCommand = args[0];
    let List = [];
    switch (SubCommand) {
      case "list":
        List = this.getBackupList();
        let Texts = [
          { text: `服务器上目前有`, color: "yellow" },
          { text: List.length, color: "aqua" },
          { text: `个备份文件\n`, color: "yellow" }
        ];
        for (let [idx, Item] of List.entries()) {
          Texts.push(
            { text: `${idx + 1}.`, color: "aqua" },
            { text: Item.filename + (idx !== List.length - 1 ? "\n" : ""), color: "yellow" }
          );
        }
        await this.tellraw("@a", Texts);
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
        if (args.length == 1) {
          await this.CommandSender(
            `tellraw @a ${JSON.stringify([
              { text: "[备份系统]", color: "green", bold: true },
              { text: `[${moment().format("HH:mm:ss")}]`, color: "yellow", bold: true },
              { text: "自助回档服务", color: "yellow" }
            ])}`
          );
          this.showPage(0, "back");
        } else if (args.length == 2) {
          let List = this.getBackupList();
          List = List.filter(a => a.filename == args[1]);
          if (List.length == 0) {
            this.tellraw("@a", [
              { text: "[备份系统]", color: "green", bold: true },
              { text: `[${moment().format("HH:mm:ss")}]`, color: "yellow", bold: true },
              { text: `找不到你选择的备份`, color: "red", bold: true }
            ]);
            return;
          }
          this.Pending="back";
          this.backPending.choice = List[0];
          this.tellraw("@a", [
            { text: "[备份系统]", color: "green", bold: true },
            { text: `[${moment().format("HH:mm:ss")}]`, color: "yellow", bold: false },
            { text: `你已经选择要恢复的备份\n`, color: "yellow", bold: false },
            { text: `名称:`, color: "yellow", bold: false },
            { text: this.backPending.choice.filename, color: "aqua", bold: true },
            { text: `\n时间:`, color: "yellow", bold: false },
            {
              text: moment(this.backPending.choice.stats.mtimeMs).format("YYYY年MM月DD日 HH:mm:ss") + "\n",
              color: "aqua",
              bold: true
            },
            { text: `输入[`, color: "yellow", bold: false },
            {
              text: "!!qb confirm",
              bold: true,
              color: "aqua",
              clickEvent: { action: "suggest_command", value: `!!qb confirm` }
            },
            { text: "]继续 ", color: "yellow", bold: false },
            { text: `输入[`, color: "yellow", bold: false },
            {
              text: "!!qb cancel",
              bold: true,
              color: "aqua",
              clickEvent: { action: "run_command", value: `!!qb cancel` }
            },
            { text: "]取消 ", color: "yellow", bold: false }
          ]);
          clearTimeout(this.backPending.Timer);
          this.backPending.Timer = setTimeout(() => {
            this.tellraw("@a", [
              { text: "[备份系统]", color: "green", bold: true },
              { text: `[${moment().format("HH:mm:ss")}]`, color: "yellow", bold: false },
              { text: `回档操作取消\n`, color: "red", bold: false }
            ]);
          }, 10000);
        }
        break;
      case "confirm":
        switch (this.Pending) {
          case "back":
            clearInterval(this.backPending.waitLoop);
            clearTimeout(this.backPending.Timer);
            if (!this.backPending.choice || this.backPending.choice == "") return;
            this.backPending.waitCount = 0;
            this.tellraw("@a", [
              { text: "[备份系统]", color: "green", bold: true },
              { text: `10`, color: "aqua", bold: true },
              { text: `秒后重启服务器回档`, color: "red", bold: false }
            ]);
            this.backPending.waitLoop = setInterval(() => {
              this.tellraw("@a", [
                { text: "[备份系统]", color: "green", bold: true },
                { text: `${10 - ++this.backPending.waitCount}`, color: "aqua", bold: true },
                { text: `秒后重启服务器回档`, color: "red", bold: false }
              ]);
              if (this.backPending.waitCount >= 10) {
                clearInterval(this.backPending.waitLoop);
                this.RunBack(this.backPending.choice);
              }
            }, 1000);
            break;
          case "delete":
            if (!this.deletePending.choice || this.deletePending.choice == "") return;
            this.deleteSave(this.deletePending.choice);
            break;
        }
        break;
      case "delete":
        if (args.length == 1) {
          await this.CommandSender(
            `tellraw @a ${JSON.stringify([
              { text: "[备份系统]", color: "green", bold: true },
              { text: `[${moment().format("HH:mm:ss")}]`, color: "yellow", bold: true },
              { text: "备份删除系统", color: "yellow" }
            ])}`
          );
          this.showPage(0, "delete");
        } else if (args.length == 2) {
          let List = this.getBackupList();
          List = List.filter(a => a.filename == args[1]);
          if (List.length == 0) {
            this.tellraw("@a", [
              { text: "[备份系统]", color: "green", bold: true },
              { text: `[${moment().format("HH:mm:ss")}]`, color: "yellow", bold: true },
              { text: `找不到你选择的备份`, color: "red", bold: true }
            ]);
            return;
          }
          this.deletePending.choice = List[0];
          this.Pending="delete";
          this.tellraw("@a", [
            { text: "[备份系统]", color: "green", bold: true },
            { text: `[${moment().format("HH:mm:ss")}]`, color: "yellow", bold: false },
            { text: `你已经选择要删除的备份\n`, color: "yellow", bold: false },
            { text: `名称:`, color: "yellow", bold: false },
            { text: this.deletePending.choice.filename, color: "aqua", bold: true },
            { text: `\n时间:`, color: "yellow", bold: false },
            {
              text: moment(this.deletePending.choice.stats.mtimeMs).format("YYYY年MM月DD日 HH:mm:ss") + "\n",
              color: "aqua",
              bold: true
            },
            { text: `输入[`, color: "yellow", bold: false },
            {
              text: "!!qb confirm",
              bold: true,
              color: "aqua",
              clickEvent: { action: "suggest_command", value: `!!qb confirm` }
            },
            { text: "]继续 ", color: "yellow", bold: false },
            { text: `输入[`, color: "yellow", bold: false },
            {
              text: "!!qb cancel",
              bold: true,
              color: "aqua",
              clickEvent: { action: "run_command", value: `!!qb cancel` }
            },
            { text: "]取消 ", color: "yellow", bold: false }
          ]);
        }
        break;
      case "cancel":
        switch (this.Pending) {
          case "back":
            this.tellraw("@a", [
              { text: "[备份系统]", color: "green", bold: true },
              { text: `[${moment().format("HH:mm:ss")}]`, color: "yellow", bold: false },
              { text: `回档操作取消\n`, color: "red", bold: false }
            ]);
            break;
          case "delete":
            this.tellraw("@a", [
              { text: "[备份系统]", color: "green", bold: true },
              { text: `[${moment().format("HH:mm:ss")}]`, color: "yellow", bold: false },
              { text: `删除操作取消\n`, color: "red", bold: false }
            ]);
            break;
        }
        this.cancelAllPending();
        break;
      case "showpage":
        if (args.length == 2) {
          this.showPage(Number(args[1]));
        }
        break;
    }
  }
  cancelAllPending() {
    clearInterval(this.backPending.waitLoop);
    clearTimeout(this.backPending.Timer);
    this.backPending = {
      Timer: 0,
      choice: "",
      waitLoop: 0,
      waitCount: 0
    };
    this.deletePending = {
      choice: ""
    };
    this.Pending = "";
  }
  getBackupList() {
    let BackupList = klawSync(this.backupDest, {
      nodir: true
    }).map(a => {
      a.filename = path.parse(a.path).base.split(".")[0];
      return a;
    });
    return BackupList.sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);
  }
  async showPage(page = 0, command) {
    if (!command) {
      command = this.Pending;
    }
    let List = this.getBackupList();
    if (!List.length) {
      await this.CommandSender(
        `tellraw @a ${JSON.stringify([
          { text: "[备份系统]", color: "green", bold: true },
          { text: `[${moment().format("HH:mm:ss")}]`, color: "yellow", bold: true },
          { text: "找不到可用的备份文件", color: "red" }
        ])}`
      );
      return;
    }
    let All = Math.floor(List.length / 5);
    let showList = List.slice(page * 5, page * 5 + 5);
    let showJSON = [
      { text: "[备份系统]", color: "green", bold: true },
      { text: `正在查看第${page + 1}页/共${Math.ceil(List.length / 5)}页\n`, color: "aqua" }
    ];
    for (let [idx, Item] of showList.entries()) {
      showJSON.push(
        { text: idx + 1 + ".", color: "aqua" },
        { text: Item.filename, color: "yellow" },
        {
          text: "【点我选择】\n",
          color: "green",
          clickEvent: { action: "run_command", value: `!!qb ${command} ${Item.filename}` }
        }
      );
    }
    showJSON.push(
      { text: "<", color: "yellow" },
      {
        text: "上一页",
        color: page == 0 ? "gray" : "green",
        clickEvent: page == 0 ? {} : { action: "run_command", value: `!!qb showpage ${page - 1}` }
      },
      { text: "|", color: "yellow" },
      {
        text: "下一页",
        color: page == All ? "gray" : "green",
        clickEvent: page == All ? {} : { action: "run_command", value: `!!qb showpage ${page + 1}` }
      },
      { text: ">", color: "yellow" }
    );
    return this.tellraw("@a", showJSON);
  }
  async RunBack(backfile) {
    console.log(`[${moment().format("HH:mm:ss")}]回档 备注:${backfile.filename}`);
    this.schedule.cancel();
    await this.CommandSender("stop");
    setTimeout(async () => {
      console.log("清空World文件夹");
      await fs.emptyDir(this.SaveSource);
      console.log("释放存档");
      await runCommand(`tar zxvf ${backfile.path} -C ${this.SaveSource}`);
      console.log("启动服务器");
      await runCommand(this.RunServer);
      console.log("完成");
      this.cancelAllPending();
    }, 3000);
  }
  async deleteSave(backfile) {
    console.log(`[${moment().format("HH:mm:ss")}]删除存档 备注:${backfile.filename}`);
    this.tellraw("@a", [
      { text: "[备份系统]", color: "green", bold: true },
      { text: `[${moment().format("HH:mm:ss")}]`, color: "yellow", bold: false },
      { text: `删除中\n`, color: "red", bold: false }
    ]);
    await fs.unlink(backfile.path)
    this.tellraw("@a", [
      { text: "[备份系统]", color: "green", bold: true },
      { text: `[${moment().format("HH:mm:ss")}]`, color: "yellow", bold: false },
      { text: `删除完成\n`, color: "red", bold: false }
    ]);
  }
  async RunBackup(comment) {
    comment = comment.replace(/(["\s'$`\\])/g, "\\$1");
    console.log(`[${moment().format("HH:mm:ss")}]运行备份 备注:${comment}`);
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
    await fs.copy(this.SaveSource, "/tmp/Minecraft/world");
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
    await fs.move(Path, `${this.backupDest}/${FileName}`);
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
        let ServerFile = klawSync(this.backupDest, {
          nodir: true
        });
        for (let File of ServerFile) {
          if (new Date().getTime() - File.stats.mtimeMs > 86400000 && /\\自动备份-/.test(File.path)) {
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
    schedule.cancelJob(this.schedule);
  }
}
module.exports = QuickBackup;
