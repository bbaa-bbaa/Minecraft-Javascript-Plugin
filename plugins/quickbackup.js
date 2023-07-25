let BasePlugin = require("../core/basePlugin.js");
const fs = require("fs-extra");
const cp = require("child_process");
const { DateTime } = require("luxon");
const util = require("util");
const schedule = require("node-schedule");
const runCommand = util.promisify(cp.exec);
const path = require("path");
const klaw = require("klaw");

class RollbackRequest extends BasePlugin {
  static PluginName = "快速备份系统-回档请求";
  constructor(Core, QuickBackup, type, requester, backfile) {
    super(Core);
    this.type = type;
    this.backfile = backfile;
    this.requester = requester;
    this.QuickBackup = QuickBackup;
    this.timer = {
      cancel: 0,
      comfirm: 0
    };
    this.countdown = {
      confirm: 0
    };
    this.twoStepConfirm();
  }
  twoStepWholeWorld() {
    this.tellraw("@a", [{ text: `你已经选择要恢复的备份`, color: "yellow", bold: false }]);
    this.tellraw("@a", [
      { text: `名称:`, color: "yellow", bold: false },
      { text: this.backfile.filename, color: "aqua", bold: true }
    ]);
    this.tellraw("@a", [
      { text: `时间:`, color: "yellow", bold: false },
      {
        text: DateTime.fromMillis(this.backfile.stats.mtimeMs).toFormat("yyyy年MM月dd日 HH:mm:ss"),
        color: "aqua",
        bold: true
      }
    ]);
    this.tellraw("@a", [
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
  async twoStepPlayerData() {
    this.tellraw("@a", [
      { text: `[${DateTime.now().toFormat("HH:mm:ss")}]`, color: "yellow", bold: false },
      { text: `你正在请求恢复${this.requester.name}的玩家数据`, color: "yellow", bold: false }
    ]);
    this.tellraw("@a", [
      { text: `名称:`, color: "yellow", bold: false },
      { text: this.backfile.filename, color: "aqua", bold: true }
    ]);
    this.tellraw("@a", [
      { text: `时间:`, color: "yellow", bold: false },
      {
        text: DateTime.fromMillis(
          (await fs.promises.stat(`${this.backfile.path}/playerdata/${this.requester.uuid}.dat`)).mtime.getTime()
        ).toFormat("yyyy年MM月dd日 HH:mm:ss"),
        color: "aqua",
        bold: true
      }
    ]);
    this.tellraw("@a", [
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
  async twoStepConfirm() {
    switch (this.type) {
      case "wholeWorld":
        this.twoStepWholeWorld();
        break;
      case "playerData":
        await this.twoStepPlayerData();
        break;
    }
    this.timer.cancel = setTimeout(() => {
      this.cancel();
      this.timer.cancel = 0;
    }, 10000);
  }
  confirm(Player) {
    if (this.QuickBackup.Lock.Rollback) {
      this.tellraw("@a", [{ text: "已有正在进行的回档进程", color: "yellow" }]);
      this.tellraw("@a", [{ text: "本次回档操作取消", color: "red" }]);
      return;
    }
    switch (this.type) {
      case "wholeWorld":
        if (this.timer.cancel) {
          clearTimeout(this.timer.cancel);
        }
        this.countdown.confirm = 0;
        this.tellraw("@a", [
          { text: `10`, color: "aqua", bold: true },
          { text: `秒后重启服务器回档`, color: "red", bold: false }
        ]);
        this.timer.comfirm = setInterval(() => {
          this.tellraw("@a", [
            { text: `${10 - ++this.countdown.confirm}`, color: "aqua", bold: true },
            { text: `秒后重启服务器回档`, color: "red", bold: false }
          ]);
          if (this.countdown.confirm >= 10) {
            clearInterval(this.timer.comfirm);
            this.timer.comfirm = 0;
            this.QuickBackup.Rollback(this.backfile)
              .finally(() => {
                this.complete();
              })
              .catch(() => {});
          }
        }, 1000);
        break;
      case "playerData":
        if (Player !== this.requester.name) {
          this.tellraw("@a", [
            { text: "回档玩家数据仅能由请求的玩家", color: "red" },
            { text: this.requester.name, color: "green" },
            { text: "确认", color: "red" }
          ]);
          return;
        }
        if (this.timer.cancel) {
          clearTimeout(this.timer.cancel);
        }
        this.countdown.confirm = 0;
        this.tellraw(this.requester.name, [
          { text: `5`, color: "aqua", bold: true },
          { text: `秒后回档`, color: "red", bold: false }
        ]);
        this.timer.comfirm = setInterval(() => {
          this.tellraw(this.requester.name, [
            { text: `${5 - ++this.countdown.confirm}`, color: "aqua", bold: true },
            { text: `秒后回档`, color: "red", bold: false }
          ]);
          if (this.countdown.confirm >= 5) {
            clearInterval(this.timer.comfirm);
            this.QuickBackup.RollbackPlayerData(this.backfile, this.requester)
              .finally(() => {
                this.complete();
              })
              .catch(() => {});
          }
        }, 1000);
    }
  }
  cancel() {
    if (this.timer.cancel) {
      clearTimeout(this.timer.cancel);
    }
    if (this.timer.comfirm) {
      clearInterval(this.timer.comfirm);
    }
    this.tellraw("@a", [
      { text: `已取消`, color: "red", bold: false },
      { text: `${this.requester.name}`, color: "yellow", bold: false },
      { text: `请求的`, color: "red", bold: false },
      { text: `${this.type == "wholeWorld" ? "整个世界" : "玩家数据"}`, color: "aqua", bold: false },
      { text: `回档请求`, color: "red", bold: false }
    ]);
    this.complete();
  }
  complete() {
    this.QuickBackup.RollbackPending = null;
  }
}

class QuickBackup extends BasePlugin {
  static PluginName = "快速备份系统";
  constructor() {
    super(...arguments);
    this.Tasks = {};
    this.Lock = {
      Backup: false,
      Rollback: false,
      lastBackupTime: 0
    };
    this.RollbackPending = null;
    this.onlyCopy = false;
    this.backupDest = this.Settings.backupDest || "/data/mcBackup/SCS";
    this.tmpDir = this.Settings.tmpDir || `/data/mcBackup/tmp`;
    this.wholeWorldDest = this.backupDest + "/World";
    this.PlayerDataDest = this.backupDest + "/Playerdata";
    this.SaveSource = `${this.Core.BaseDir}/world`;
    fs.ensureDir(this.backupDest);
    fs.ensureDir(this.wholeWorldDest);
    fs.ensureDir(this.PlayerDataDest);
  }
  init(Plugin) {
    Plugin.registerCommand("qb", this.Cli);
    this.Core.EventBus.on("playerlistchange", List => {
      if (List == 0) {
        this.MakeBackup(`自动备份-玩家离开-${DateTime.now().toFormat("yyyy-MM-dd-HH-mm-ss")}`, true);
      }
    });
  }
  async getBackupList(list) {
    let BackupList = [];
    if (list == "wholeWorld") {
      if (this.onlyCopy) {
        BackupList = (await fs.promises.readdir(this.wholeWorldDest)).map(filename => ({
          filename,
          path: path.join(this.wholeWorldDest, filename)
        }));
        for (let tmp of BackupList) {
          tmp.stats = await fs.promises.stat(tmp.path);
        }
      } else {
        BackupList = (await fs.promises.readdir(this.wholeWorldDest)).map(filename => ({
          filename: filename.split(".")[0],
          path: path.join(this.wholeWorldDest, filename)
        }));
        for (let tmp of BackupList) {
          tmp.stats = await fs.promises.stat(tmp.path);
        }
      }
    } else if (list == "playerData") {
      BackupList = (await fs.promises.readdir(this.PlayerDataDest)).map(filename => ({
        filename,
        path: path.join(this.PlayerDataDest, filename)
      }));
      for (let tmp of BackupList) {
        tmp.stats = await fs.promises.stat(tmp.path);
      }
    }
    return BackupList.sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);
  }
  async showPage(page = 0, list = "wholeWorld", command) {
    let List = await this.getBackupList(list);
    if (!List.length) {
      await this.tellraw(`@a`, [
        { text: `[${DateTime.now().toFormat("HH:mm:ss")}]`, color: "yellow", bold: true },
        { text: "找不到可用的备份文件", color: "red" }
      ]);
      return;
    }
    let All = Math.ceil(List.length / 5);
    let showList = List.slice(page * 5, page * 5 + 5);
    let showJSON = [{ text: `正在查看第${page + 1}页/共${All}页\n`, color: "aqua" }];
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
        clickEvent: page == 0 ? {} : { action: "run_command", value: `!!qb list ${list} ${page - 1} ${command}` }
      },
      { text: "|", color: "yellow" },
      {
        text: "下一页",
        color: page == All - 1 ? "gray" : "green",
        clickEvent: page == All - 1 ? {} : { action: "run_command", value: `!!qb list ${list} ${page + 1} ${command}` }
      },
      { text: ">", color: "yellow" }
    );
    return this.tellraw("@a", showJSON);
  }
  async Cli(Player, ...args) {
    let SubCommand = args[0];
    let List = [];
    switch (SubCommand) {
      case "list":
        if (args.length == 4) {
          this.showPage(Number(args[2]), args[1], args[3]);
        }
        break;
      case "make":
        let comment = args[1];
        if (comment) {
          await this.MakeBackup(comment);
        } else {
          await this.tellraw(`@a`, [
            { text: `命令格式:`, color: "yellow", bold: true },
            { text: "!!qb", color: "yellow" },
            { text: " make ", color: "aqua" },
            { text: "<备注信息>", color: "red" }
          ]);
        }
        break;
      case "help":
      default:
        await this.tellraw(`@a`, [{ text: `======命令列表======`, color: "yellow", bold: true }]);
        await this.tellraw(`@a`, [
          { text: "!!qb", color: "yellow" },
          { text: " make ", color: "aqua" },
          { text: "<备注信息> ", color: "red" },
          { text: "-创建一个名为<备注信息>的备份", color: "aqua" }
        ]);
        await this.tellraw(`@a`, [
          { text: "!!qb", color: "yellow" },
          { text: " list ", color: "aqua" },
          { text: "- 显示所有备份列表", color: "aqua" }
        ]);
        await this.tellraw(`@a`, [
          { text: "!!qb", color: "yellow" },
          { text: " back ", color: "aqua" },
          { text: "[备注信息] ", color: "green" },
          { text: "- 回档到指定存档", color: "aqua" }
        ]);
        await this.tellraw(`@a`, [
          { text: "!!qb", color: "yellow" },
          { text: " backpd ", color: "aqua" },
          { text: "[备注信息] ", color: "green" },
          { text: "- BackPlayerData 恢复玩家数据", color: "aqua" }
        ]);
        break;
      case "back":
        if (args.length == 1) {
          await this.tellraw(`@a`, [{ text: "自助回档服务", color: "yellow" }]);
          this.showPage(0, "wholeWorld", "back");
        } else {
          let List = await this.getBackupList("wholeWorld");
          List = List.filter(a => a.filename == args[1]);
          if (List.length == 0) {
            this.tellraw("@a", [
              { text: `[${DateTime.now().toFormat("HH:mm:ss")}]`, color: "yellow", bold: true },
              { text: `找不到你选择的备份`, color: "red", bold: true }
            ]);
            return;
          }
          if (this.RollbackPending) this.RollbackPending.cancel();
          this.RollbackPending = new RollbackRequest(
            this.Core,
            this,
            "wholeWorld",
            {
              name: Player
            },
            List[0]
          );
        }
        break;
      case "backpd":
        if (args.length == 1) {
          await this.tellraw(`@a`, [
            { text: `[${DateTime.now().toFormat("HH:mm:ss")}]`, color: "yellow", bold: true },
            { text: "自助回档服务", color: "yellow" }
          ]);
          this.Pending = "backpd";
          this.showPage(0, "playerData", "backpd");
        } else if (args.length == 2) {
          let List = await this.getBackupList("playerData");
          List = List.filter(a => a.filename == args[1]);
          if (List.length == 0) {
            this.tellraw("@a", [
              { text: `[${DateTime.now().toFormat("HH:mm:ss")}]`, color: "yellow", bold: true },
              { text: `找不到你选择的备份`, color: "red", bold: true }
            ]);
            return;
          }
          let requester = { name: Player, uuid: await this.getUUID(Player) };
          if (requester.uuid == "00000000-0000-0000-0000-000000000000") {
            this.tellraw("@a", [{ text: `找不到你选择的玩家`, color: "red", bold: true }]);
            return;
          }
          if (this.RollbackPending) this.RollbackPending.cancel();
          this.RollbackPending = new RollbackRequest(this.Core, this, "playerData", requester, List[0]);
        }
        break;
      case "confirm":
        if (this.RollbackPending) {
          this.RollbackPending.confirm(Player);
        } else {
          this.tellraw("@a", [{ text: "无正在进行的回档请求", color: "red" }]);
        }
        break;
      case "cancel":
        if (this.RollbackPending) {
          this.RollbackPending.cancel();
        } else {
          this.tellraw("@a", [{ text: "无正在进行的回档请求", color: "red" }]);
        }
        break;
    }
  }
  async MakeBackup(name, auto = false) {
    this.tellraw("@a", [
      { text: "============= ", color: "yellow" },
      { text: "整世界备份", color: "light_purple" },
      { text: " 时间：", color: "green" },
      { text: DateTime.now().toFormat("HH:mm:ss"), color: "aqua", bold: true },
      { text: " =============", color: "yellow" }
    ]);
    if (this.Lock.Backup) {
      this.tellraw("@a", [{ text: "已有正在进行的备份进程", color: "yellow" }]);
      this.tellraw("@a", [{ text: "本次备份操作取消", color: "red" }]);
      return;
    }
    if (auto && new Date().getTime() - this.Lock.lastBackupTime < 600000) {
      this.tellraw("@a", [{ text: "与上次自动备份间隔时间过短", color: "yellow" }]);
      this.tellraw("@a", [{ text: "本次备份操作取消", color: "red" }]);
      return;
    }
    this.Lock.Backup = true;
    this.Lock.lastBackupTime = new Date().getTime();
    name = name.replace(/(["\s'$`\\])/g, "\\$1");
    this.PluginLog(`[${DateTime.now().toFormat("HH:mm:ss")}]运行备份 备注:${name}`);
    let FileName = this.onlyCopy ? `${name}` : `${name}.tar.zst`;
    let Path = `${this.tmpDir}/Minecraft/${FileName}`;
    await this.tellraw(`@a`, [
      { text: "正在保存存档 ", color: "yellow" },
      { text: "请勿快速移动", color: "red" }
    ]);
    await this.CommandSender("save-all");
    await this.tellraw(`@a`, [{ text: "存档保存成功", color: "green" }]);
    if (this.onlyCopy) {
      await fs.ensureDir(`${this.wholeWorldDest}/${FileName}`);
      await fs
        .copy(this.SaveSource, `${this.wholeWorldDest}/${FileName}`, {
          preserveTimestamps: true
        })
        .then(a => false)
        .catch(a => true);
      let size = 0;
      for await (const file of klaw(`${this.wholeWorldDest}/${FileName}`)) {
        size += file.stats.size || 0;
      }
      size = size / 1024 / 1024;
      await this.tellraw(`@a`, [
        { text: `存档复制完成 存档大小：`, color: "aqua" },
        { text: `${size.toFixed(2)}M`, color: "green", bold: true }
      ]);
    } else {
      await this.tellraw(`@a`, [{ text: "正在打包存档", color: "yellow" }]);
      await fs.ensureDir(`${this.tmpDir}/Minecraft/world`);
      let CleanList = fs.readdirSync(`${this.tmpDir}/Minecraft`).filter(a => /tar\.zst/.test(a));
      for (let Item of CleanList) {
        await fs.promises.unlink(`${this.tmpDir}/Minecraft/` + Item);
      }
      await fs.emptyDir(`${this.tmpDir}/Minecraft/world`);
      while (
        await fs
          .copy(this.SaveSource, `${this.tmpDir}/Minecraft/world`, {
            preserveTimestamps: true
          })
          .then(a => false)
          .catch(a => true)
      ) {
        // do notings
      }
      if (this.platform != "win32") {
        await runCommand(`bash -c 'tar --zstd -cvf ../${FileName} *'`, { cwd: `${this.tmpDir}/Minecraft/world` });
      }
      await fs.emptyDir(`${this.tmpDir}/Minecraft/world`);
      let Stat = fs.statSync(Path);
      let Size = Stat.size / 1048576;
      await this.tellraw(`@a`, [
        { text: "存档打包完成 存档大小:", color: "green" },
        { text: `${Size.toFixed(2)}M`, color: "yellow", bold: true }
      ]);
      await this.tellraw(`@a`, [{ text: "正在上传存档到备份服务器", color: "yellow" }]);
      await fs.move(Path, `${this.wholeWorldDest}/${FileName}`);
      await this.tellraw(`@a`, [{ text: "存档上传成功", color: "green" }]);
    }
    this.tellraw("@a", [
      { text: "============= ", color: "yellow" },
      { text: "备份进程结束", color: "light_purple" },
      { text: " 时间：", color: "green" },
      { text: DateTime.now().toFormat("HH:mm:ss"), color: "aqua", bold: true },
      { text: " =============", color: "yellow" }
    ]);
    this.Lock.Backup = false;
  }

  async MakeBackupPlayerData(comment) {
    comment = comment.replace(/(["\s'$`\\])/g, "\\$1");
    this.PluginLog(`[${DateTime.now().toFormat("HH:mm:ss")}]运行玩家数据备份 备注:${comment}`);
    let FileName = `${comment}`;
    let ServerFile = (await fs.promises.readdir(this.PlayerDataDest)).map(filename => ({
      filename,
      path: path.join(this.PlayerDataDest, filename)
    }));
    for (let tmp of ServerFile) {
      tmp.stats = await fs.promises.stat(tmp.path);
    }
    ServerFile.sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);
    for (let File of ServerFile.slice(5)) {
      if (new Date().getTime() - File.stats.mtimeMs > 3600000) {
        await fs.remove(File.path);
      }
    }
    await fs.ensureDir(`${this.PlayerDataDest}/${FileName}/`);
    for (let sourcename of [`playerdata`, `advancements`, `stats`]) {
      await fs.ensureDir(`${this.PlayerDataDest}/${FileName}/${sourcename}/`).catch(e => console.error(e));
      await fs
        .copy(`${this.SaveSource}/${sourcename}/`, `${this.PlayerDataDest}/${FileName}/${sourcename}/`, {
          preserveTimestamps: true
        })
        .catch(e => console.error(e));
    }
    this.PluginLog(`[${DateTime.now().toFormat("HH:mm:ss")}]完成玩家数据备份`);
  }

  async Rollback(backfile, requester) {
    this.PluginLog(`[${DateTime.now().toFormat("HH:mm:ss")}]回档 备注:${backfile.filename}`);
    this.Lock.Rollback = true;
    await this.CommandSender("stop");
    this.emit("disconnected");
    setTimeout(async () => {
      this.PluginLog(`清空World文件夹`);
      await fs.emptyDir(this.SaveSource);
      if (!this.onlyCopy) {
        this.PluginLog(`释放存档`);
        if (this.platform != "win32") {
          await runCommand(`bash -c 'tar --zstd -xvf "${backfile.path}" -C "${this.SaveSource}"'`);
        }
      } else {
        this.PluginLog(`复制存档`);
        await fs
          .copy(backfile.path, this.SaveSource, {
            preserveTimestamps: true
          })
          .then(a => false)
          .catch(a => true);
      }
      this.PluginLog(`启动服务器`);
      this.Core.PendingRestart = true;
      this.PluginLog(`完成`);
      this.Lock.Rollback = false;
      this.ipc.of["MinecraftManager"].emit("state");
    }, 3000);
  }

  async RollbackPlayerData(backfile, requester) {
    this.PluginLog(`[${DateTime.now().toFormat("HH:mm:ss")}]回档-仅玩家数据 备注:${backfile.filename}`);
    this.PluginLog(`请求者信息:${JSON.stringify(requester)}`);
    this.Lock.Rollback = true;
    await this.CommandSender("kick " + requester.name + " 正在准备回档");
    await this.CommandSender("ban " + requester.name + " 正在回档");
    setTimeout(async () => {
      this.PluginLog(`释放存档[${backfile.path}]`);
      let fileList = [];
      let regexUUID = new RegExp(requester.uuid, "i");
      for await (const file of klaw(backfile.path)) {
        if (regexUUID.test(file.path)) {
          fileList.push(file.path.replace(new RegExp(`^${backfile.path}/`), ""));
        }
      }
      for (let file of fileList) {
        await fs
          .copy(`${backfile.path}/${file}`, `${this.SaveSource}/${file}`, {
            preserveTimestamps: true
          })
          .catch(e => console.error(e));
      }
      this.PluginLog(`完成`);
      await this.CommandSender("pardon " + requester.name);
      this.Lock.Rollback = false;
    }, 3000);
  }
  async cleanBackup() {
    if (!this.onlyCopy) {
      let ServerFile = (await fs.promises.readdir(this.wholeWorldDest)).map(filename => ({
        filename,
        path: path.join(this.wholeWorldDest, filename)
      }));
      for (let tmp of ServerFile) {
        tmp.stats = await fs.promises.stat(tmp.path);
      }
      ServerFile = ServerFile.sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);
      for (let File of ServerFile) {
        if (new Date().getTime() - File.stats.mtimeMs > 86400000 * 2) {
          await fs.unlink(File.path);
        }
      }
    } else {
      let ServerFile = await fs.promises.readdir(this.wholeWorldDest);
      ServerFile = ServerFile.filter(a => /自动备份-/.test(a))
        .map(a => ({ stats: fs.statSync(this.wholeWorldDest + "/" + a), path: this.wholeWorldDest + "/" + a }))
        .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);
      for (let File of ServerFile) {
        if (new Date().getTime() - File.stats.mtimeMs > 86400000 * 2) {
          this.PluginLog("删除备份" + File.path);
          await fs.remove(File.path);
        }
      }
    }
    return Promise.resolve();
  }
  async Start() {
    this.Tasks.wholeWorld = schedule.scheduleJob("0 */10 * * * *", async () => {
      if (this.Core.Players.length) {
        await this.cleanBackup();
        this.MakeBackup(`自动备份-${DateTime.now().toFormat("yyyy-MM-dd-HH-mm-ss")}`)
          .then(() => {
            return this.tellraw(`@a`, [
              { text: `如果你正在进行大型项目的建设，可通过命令:\n`, color: "gold", bold: true },
              { text: "!!qb", color: "yellow" },
              { text: " make ", color: "aqua" },
              { text: "<备注信息>", color: "red" },
              { text: "\n来进行存档的备份", color: "aqua" }
            ]);
          })
          .catch(() => {});
      }
    });
    this.Tasks.PlayerData = schedule.scheduleJob("0 * * * * *", async () => {
      if (this.Core.Players.length) {
        this.MakeBackupPlayerData(`自动备份-${DateTime.now().toFormat("yyyy-MM-dd-HH-mm-ss")}`).catch(() => {});
      }
    });
    await this.cleanBackup();
    this.MakeBackupPlayerData(`自动备份-${DateTime.now().toFormat("yyyy-MM-dd-HH-mm-ss")}`).catch(() => {});
    return this.tellraw(`@a`, [
      { text: `如果你正在进行大型项目的建设，可通过命令:\n`, color: "gold", bold: true },
      { text: "!!qb", color: "yellow" },
      { text: " make ", color: "aqua" },
      { text: "<备注信息>", color: "red" },
      { text: "\n来进行存档的备份", color: "aqua" }
    ]);
  }
  Pause() {
    for (let scheduleJob of Object.values(this.Tasks)) {
      scheduleJob.cancel();
    }
  }
}
module.exports = QuickBackup;
