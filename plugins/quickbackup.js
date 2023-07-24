let BasePlugin = require("../core/basePlugin.js");
const fs = require("fs-extra");
const cp = require("child_process");
const { DateTime } = require("luxon");
const util = require("util");
const schedule = require("node-schedule");
const runCommand = util.promisify(cp.exec);
const path = require("path");
const klaw = require("klaw");
class QuickBackup extends BasePlugin {
  static PluginName = "快速备份系统";
  constructor() {
    super(...arguments);
    this.schedule = null;
    this.backupDest = this.Settings.backupDest || "/data/mcBackup/SCS";
    this.tmpDir = this.Settings.tmpDir || `/data/mcBackup/tmp`;
    this.onlyCopy = true;
    this.wholeWorldDest = this.backupDest + "/World";
    this.PlayerDataDest = this.backupDest + "/Playerdata";
    this.SaveSource = `${this.Core.BaseDir}/world`;
    fs.ensureDir(this.backupDest);
    fs.ensureDir(this.wholeWorldDest);
    fs.ensureDir(this.PlayerDataDest);
    this.lastBackup = 0;
    this.Backuping = false;
    this.backPending = {
      Timer: 0,
      choice: "",
      waitLoop: 0,
      waitCount: 0
    };
    this.backpdPending = {
      Timer: 0,
      choice: "",
      waitLoop: 0,
      waitCount: 0,
      requester: {
        name: "",
        uuid: ""
      }
    };
    this.deletePending = {
      choice: ""
    };
    this.Pending = "";
    this.Rollbacking = false;
  }
  init(Plugin) {
    Plugin.registerCommand("qb", this.Cli);
    this.Core.EventBus.on("playerlistchange", List => {
      if (List == 0 && !this.Rollbacking) {
        this.RunBackup(`自动备份-玩家离开-${DateTime.now().toFormat("yyyy-MM-dd-HH-mm-ss")}`);
      }
    });
  }
  async Cli(Player, ...args) {
    let SubCommand = args[0];
    let List = [];
    switch (SubCommand) {
      case "list":
        List = await this.getBackupList("wholeWorld");
        let Texts = [
          { text: `服务器上目前有`, color: "yellow" },
          { text: List.length, color: "aqua" },
          { text: `个备份文件\n`, color: "yellow" }
        ];
        console.log(List);
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
          await this.tellraw(`@a`, [
            { text: `命令格式:`, color: "yellow", bold: true },
            { text: "!!qb", color: "yellow" },
            { text: " make ", color: "aqua" },
            { text: "<备注信息>", color: "red" }
          ]);
        }
      case "help":
      default:
        await this.tellraw(`@a`, [
          { text: `======命令列表======\n`, color: "yellow", bold: true },
          { text: "!!qb", color: "yellow" },
          { text: " make ", color: "aqua" },
          { text: "<备注信息> ", color: "red" },
          { text: "-创建一个名为<备注信息>的备份\n", color: "aqua" },
          { text: "!!qb", color: "yellow" },
          { text: " list ", color: "aqua" },
          { text: "- 显示所有备份列表\n", color: "aqua" },
          { text: "!!qb", color: "yellow" },
          { text: " back ", color: "aqua" },
          { text: "[备注信息] ", color: "green" },
          { text: "- 回档到指定存档\n", color: "aqua" },
          { text: "!!qb", color: "yellow" },
          { text: " delete ", color: "aqua" },
          { text: "[备注信息] ", color: "green" },
          { text: "- 删除指定存档\n", color: "aqua" },
          { text: "!!qb", color: "yellow" },
          { text: " backpd ", color: "aqua" },
          { text: "[备注信息] ", color: "green" },
          { text: "- BackPlayerData 恢复玩家数据", color: "aqua" }
        ]);
        break;
      case "back":
        if (args.length == 1) {
          await this.tellraw(`@a`, [
            { text: `[${DateTime.now().toFormat("HH:mm:ss")}]`, color: "yellow", bold: true },
            { text: "自助回档服务", color: "yellow" }
          ]);
          this.Pending = "back";
          this.showPage(0, "wholeWorld", "back");
        } else if (args.length == 2) {
          let List = await this.getBackupList("wholeWorld");
          List = List.filter(a => a.filename == args[1]);
          if (List.length == 0) {
            this.tellraw("@a", [
              { text: `[${DateTime.now().toFormat("HH:mm:ss")}]`, color: "yellow", bold: true },
              { text: `找不到你选择的备份`, color: "red", bold: true }
            ]);
            return;
          }
          this.cancelAllPending();
          this.Pending = "back";
          this.backPending.choice = List[0];
          this.tellraw("@a", [
            { text: `[${DateTime.now().toFormat("HH:mm:ss")}]`, color: "yellow", bold: false },
            { text: `你已经选择要恢复的备份\n`, color: "yellow", bold: false },
            { text: `名称:`, color: "yellow", bold: false },
            { text: this.backPending.choice.filename, color: "aqua", bold: true },
            { text: `\n时间:`, color: "yellow", bold: false },
            {
              text:
                DateTime.fromMillis(this.backPending.choice.stats.mtimeMs).toFormat("YYYY年MM月DD日 HH:mm:ss") + "\n",
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
            this.cancelAllPending();
            this.tellraw("@a", [
              { text: `[${DateTime.now().toFormat("HH:mm:ss")}]`, color: "yellow", bold: false },
              { text: `回档操作取消`, color: "red", bold: false }
            ]);
          }, 10000);
        }
        break;
      case "backpd":
        if (!this.newVersion) {
          await this.tellraw(`@a`, [
            { text: `[${DateTime.now().toFormat("HH:mm:ss")}]`, color: "yellow", bold: true },
            { text: "自助回档服务：", color: "aqua" },
            { text: "回档玩家数据在该版本未经测试，谨慎使用", color: "red" }
          ]);
        }
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
          this.cancelAllPending();
          this.Pending = "backpd";
          this.backpdPending.choice = List[0];
          this.backpdPending.requester.name = Player;
          this.backpdPending.requester.uuid = await this.getUUID(Player);
          if (this.backpdPending.requester.uuid == "00000000-0000-0000-0000-000000000000") {
            this.tellraw("@a", [
              { text: `[${DateTime.now().toFormat("HH:mm:ss")}]`, color: "yellow", bold: true },
              { text: `找不到你选择的玩家`, color: "red", bold: true }
            ]);
            this.cancelAllPending();
          }
          this.tellraw("@a", [
            { text: `[${DateTime.now().toFormat("HH:mm:ss")}]`, color: "yellow", bold: false },
            { text: `你正在请求恢复${Player}的玩家数据\n`, color: "yellow", bold: false },
            { text: `名称:`, color: "yellow", bold: false },
            { text: this.backpdPending.choice.filename, color: "aqua", bold: true },
            { text: `\n时间:`, color: "yellow", bold: false },
            {
              text:
                DateTime.fromMillis(
                  (
                    await fs.promises.stat(
                      `${this.backpdPending.choice.path}/playerdata/${this.backpdPending.requester.uuid}.dat`
                    )
                  ).mtime
                ).toFormat("YYYY年MM月DD日 HH:mm:ss") + "\n",
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
          clearTimeout(this.backpdPending.Timer);
          this.backpdPending.Timer = setTimeout(() => {
            this.cancelAllPending();
            this.tellraw("@a", [
              { text: `[${DateTime.now().toFormat("HH:mm:ss")}]`, color: "yellow", bold: false },
              { text: `回档操作取消`, color: "red", bold: false }
            ]);
          }, 10000);
        }
        break;
      case "confirm":
        switch (this.Pending) {
          case "back":
            clearInterval(this.backPending.waitLoop);
            clearTimeout(this.backPending.Timer);
            if (this.Rollbacking) {
              this.tellraw(this.backpdPending.requester.name, [
                { text: `正在另一个回档进程之中，该请求取消`, color: "red", bold: false }
              ]);
              return;
            }
            if (!this.backPending.choice || this.backPending.choice == "") return;
            this.backPending.waitCount = 0;
            this.tellraw("@a", [
              { text: `10`, color: "aqua", bold: true },
              { text: `秒后重启服务器回档`, color: "red", bold: false }
            ]);
            this.backPending.waitLoop = setInterval(() => {
              this.tellraw("@a", [
                { text: `${10 - ++this.backPending.waitCount}`, color: "aqua", bold: true },
                { text: `秒后重启服务器回档`, color: "red", bold: false }
              ]);
              if (this.backPending.waitCount >= 10) {
                clearInterval(this.backPending.waitLoop);
                this.RunBack(this.backPending.choice).catch(() => {});
              }
            }, 1000);
            break;
          case "delete":
            if (!this.deletePending.choice || this.deletePending.choice == "") return;
            this.deleteSave(this.deletePending.choice).catch(() => {});
            break;
          case "backpd":
            clearInterval(this.backpdPending.waitLoop);
            clearTimeout(this.backpdPending.Timer);
            if (this.Rollbacking) {
              this.tellraw(this.backpdPending.requester.name, [
                { text: `正在另一个回档进程之中，该请求取消`, color: "red", bold: false }
              ]);
              return;
            }
            if (!this.backpdPending.choice || this.backpdPending.choice == "") return;
            this.backpdPending.waitCount = 0;
            this.tellraw(this.backpdPending.requester.name, [
              { text: `5`, color: "aqua", bold: true },
              { text: `秒后回档`, color: "red", bold: false }
            ]);
            this.backpdPending.waitLoop = setInterval(() => {
              this.tellraw(this.backpdPending.requester.name, [
                { text: `${5 - ++this.backpdPending.waitCount}`, color: "aqua", bold: true },
                { text: `秒后回档`, color: "red", bold: false }
              ]);
              if (this.backpdPending.waitCount >= 5) {
                clearInterval(this.backpdPending.waitLoop);
                this.RunBackPd(this.backpdPending.choice).catch(() => {});
              }
            }, 1000);
            break;
        }
        break;
      case "delete":
        if (args.length == 1) {
          await this.tellraw(`@a`, [
            { text: `[${DateTime.now().toFormat("HH:mm:ss")}]`, color: "yellow", bold: true },
            { text: "备份删除系统", color: "yellow" }
          ]);
          this.Pending = "delete";
          this.showPage(0, "wholeWorld", "delete");
        } else if (args.length == 2) {
          let List = await this.getBackupList("wholeWorld");
          List = List.filter(a => a.filename == args[1]);
          if (List.length == 0) {
            this.tellraw("@a", [
              { text: `[${DateTime.now().toFormat("HH:mm:ss")}]`, color: "yellow", bold: true },
              { text: `找不到你选择的备份`, color: "red", bold: true }
            ]);
            return;
          }
          this.cancelAllPending();
          this.deletePending.choice = List[0];
          this.Pending = "delete";
          this.tellraw("@a", [
            { text: `[${DateTime.now().toFormat("HH:mm:ss")}]`, color: "yellow", bold: false },
            { text: `你已经选择要删除的备份\n`, color: "yellow", bold: false },
            { text: `名称:`, color: "yellow", bold: false },
            { text: this.deletePending.choice.filename, color: "aqua", bold: true },
            { text: `\n时间:`, color: "yellow", bold: false },
            {
              text:
                DateTime.fromMillis(this.deletePending.choice.stats.mtimeMs).toFormat("YYYY年MM月DD日 HH:mm:ss") + "\n",
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
          case "backpd":
            this.tellraw("@a", [
              { text: `[${DateTime.now().toFormat("HH:mm:ss")}]`, color: "yellow", bold: false },
              { text: `回档操作取消`, color: "red", bold: false }
            ]);
            break;
          case "delete":
            this.tellraw("@a", [
              { text: `[${DateTime.now().toFormat("HH:mm:ss")}]`, color: "yellow", bold: false },
              { text: `删除操作取消`, color: "red", bold: false }
            ]);
            break;
        }
        this.cancelAllPending();
        break;
      case "showpage":
        if (args.length == 3) {
          this.showPage(Number(args[2]), args[1]);
        }
        break;
    }
  }
  cancelAllPending() {
    clearInterval(this.backPending.waitLoop);
    clearTimeout(this.backPending.Timer);
    clearInterval(this.backpdPending.waitLoop);
    clearTimeout(this.backpdPending.Timer);
    this.backPending = {
      Timer: 0,
      choice: "",
      waitLoop: 0,
      waitCount: 0
    };
    this.backpdPending = {
      Timer: 0,
      choice: "",
      waitLoop: 0,
      waitCount: 0,
      requester: {
        name: "",
        uuid: ""
      }
    };
    this.deletePending = {
      choice: ""
    };
    this.Pending = "";
    this.Rollbacking = false;
  }
  async getBackupList(list) {
    let BackupList = [];
    if (list == "wholeWorld") {
      if (!this.onlyCopy) {
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
    if (!command) {
      command = this.Pending;
      if (!this.Pending) {
        await this.tellraw(`@a`, [
          { text: `[${DateTime.now().toFormat("HH:mm:ss")}]`, color: "yellow", bold: true },
          { text: "该回档请求已经过期，请重新请求回档", color: "red" }
        ]);
        return;
      }
    }
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
        clickEvent: page == 0 ? {} : { action: "run_command", value: `!!qb showpage ${list} ${page - 1}` }
      },
      { text: "|", color: "yellow" },
      {
        text: "下一页",
        color: page == All - 1 ? "gray" : "green",
        clickEvent: page == All - 1 ? {} : { action: "run_command", value: `!!qb showpage ${list} ${page + 1}` }
      },
      { text: ">", color: "yellow" }
    );
    return this.tellraw("@a", showJSON);
  }
  async RunBack(backfile) {
    this.PluginLog(`[${DateTime.now().toFormat("HH:mm:ss")}]回档 备注:${backfile.filename}`);
    this.Rollbacking = true;
    this.schedule.cancel();
    this.schedule2.cancel();
    await this.CommandSender("stop");
    this.emit("disconnected");
    setTimeout(async () => {
      this.PluginLog(`清空World文件夹`);
      await fs.emptyDir(this.SaveSource);
      if (!this.onlyCopy) {
        this.PluginLog(`释放存档`);
        if (this.platform != "win32") {
          await runCommand(`bash -c 'tar --zstd -xvf "${backfile.path}" -C "${this.SaveSource}"'`);
        } else {
          await runCommand(`tar -zxvf "${backfile.path}" -C "${this.SaveSource}"`);
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
      this.cancelAllPending();
      this.ipc.of.GM.emit("state");
      //this.Core.reconnectRcon("QuickBackup");
    }, 3000);
  }
  async RunBackPd(backfile) {
    this.PluginLog(`[${DateTime.now().toFormat("HH:mm:ss")}]回档-仅玩家数据 备注:${backfile.filename}`);
    this.PluginLog(`请求者信息:${JSON.stringify(this.backpdPending.requester)}`);
    this.Rollbacking = true;
    await this.CommandSender("kick " + this.backpdPending.requester.name + " 正在准备回档");
    await this.CommandSender("ban " + this.backpdPending.requester.name + " 正在回档");
    setTimeout(async () => {
      this.PluginLog(`释放存档[${backfile.path}]`);
      let fileList = [];
      let regexUUID = new RegExp(this.backpdPending.requester.uuid, "i");
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
      await this.CommandSender("pardon " + this.backpdPending.requester.name);
      this.cancelAllPending();
    }, 3000);
  }
  async deleteSave(backfile) {
    this.PluginLog(`[${DateTime.now().toFormat("HH:mm:ss")}]删除存档 备注:${backfile.filename}`);
    this.tellraw("@a", [
      { text: `[${DateTime.now().toFormat("HH:mm:ss")}]`, color: "yellow", bold: false },
      { text: `删除中`, color: "red", bold: false }
    ]);
    if (this.platform != "win32") {
      await runCommand(`bash -c 'rm -rf "${backfile.path}"'`).catch(a => "");
    } else {
      await runCommand(`rmdir /s /q "${backfile.path}"`);
    }
    this.tellraw("@a", [
      { text: `[${DateTime.now().toFormat("HH:mm:ss")}]`, color: "yellow", bold: false },
      { text: `删除完成`, color: "red", bold: false }
    ]);
    this.cancelAllPending();
  }
  async RunBackup(comment) {
    if (this.Backuping) {
      this.PluginLog("已经在备份进程之中");
      await this.tellraw(`@a`, [
        { text: `[${DateTime.now().toFormat("HH:mm:ss")}]`, color: "yellow", bold: true },
        { text: "已经在备份进程之中", color: "yellow" }
      ]);
      return;
    }
    if (/自动备份-/.test(comment) && new Date().getTime() - this.lastBackup < 600000) {
      this.PluginLog("与上次备份间隔小于600秒，消除抖动忽略本次备份");
      await this.tellraw(`@a`, [
        { text: `[${DateTime.now().toFormat("HH:mm:ss")}]`, color: "yellow", bold: true },
        { text: "已经在备份进程之中", color: "yellow" }
      ]);
      return;
    }
    this.lastBackup = new Date().getTime();
    comment = comment.replace(/(["\s'$`\\])/g, "\\$1");
    this.PluginLog(`[${DateTime.now().toFormat("HH:mm:ss")}]运行备份 备注:${comment}`);
    let FileName = this.onlyCopy ? `${comment}` : this.platform != "win32" ? `${comment}.tar.zst` : `${comment}.tar.gz`;
    let Path = `${this.tmpDir}/Minecraft/${FileName}`;
    await this.tellraw(`@a`, [
      { text: `[${DateTime.now().toFormat("HH:mm:ss")}]`, color: "yellow", bold: true },
      { text: "服务器正在备份...", color: "yellow" }
    ]);
    await this.tellraw(`@a`, [
      { text: `[${DateTime.now().toFormat("HH:mm:ss")}]`, color: "yellow", bold: true },
      { text: "正在保存存档 ", color: "yellow" },
      { text: "请勿快速移动", color: "red" }
    ]);
    await this.CommandSender("save-all");
    await this.tellraw(`@a`, [
      { text: `[${DateTime.now().toFormat("HH:mm:ss")}]`, color: "yellow", bold: true },
      { text: "存档保存成功", color: "green" }
    ]);
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
        { text: `[${DateTime.now().toFormat("HH:mm:ss")}]`, color: "yellow", bold: true },
        { text: `存档复制完成 存档大小：`, color: "aqua" },
        { text: `${size.toFixed(2)}M`, color: "green", bold: true }
      ]);
    } else {
      await this.tellraw(`@a`, [
        { text: `[${DateTime.now().toFormat("HH:mm:ss")}]`, color: "yellow", bold: true },
        { text: "正在打包存档", color: "yellow" }
      ]);
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
      } else {
        await runCommand(`tar -zcvf ../${FileName} .`, { cwd: `${this.tmpDir}/Minecraft/world` });
      }
      await fs.emptyDir(`${this.tmpDir}/Minecraft/world`);
      let Stat = fs.statSync(Path);
      let Size = Stat.size / 1048576;
      await this.tellraw(`@a`, [
        { text: `[${DateTime.now().toFormat("HH:mm:ss")}]`, color: "yellow", bold: true },
        { text: "存档打包完成 存档大小:", color: "green" },
        { text: `${Size.toFixed(2)}M`, color: "yellow", bold: true }
      ]);
      await this.tellraw(`@a`, [
        { text: `[${DateTime.now().toFormat("HH:mm:ss")}]`, color: "yellow", bold: true },
        { text: "正在上传存档到备份服务器", color: "yellow" }
      ]);
      await fs.move(Path, `${this.wholeWorldDest}/${FileName}`);
      await this.tellraw(`@a`, [
        { text: `[${DateTime.now().toFormat("HH:mm:ss")}]`, color: "yellow", bold: true },
        { text: "存档上传成功", color: "green" }
      ]);
    }
    await this.tellraw(`@a`, [
      { text: `[${DateTime.now().toFormat("HH:mm:ss")}]`, color: "yellow", bold: true },
      { text: "备份进程结束", color: "yellow" }
    ]);
  }
  async RunBackupPlayerData(comment) {
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
  async Start() {
    this.schedule = schedule.scheduleJob("0 30 * * * *", async () => {
      if (this.Core.Players.length) {
        await this.cleanBackup();
        this.RunBackup(`自动备份-${DateTime.now().toFormat("yyyy-MM-dd-HH-mm-ss")}`)
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
    this.schedule2 = schedule.scheduleJob("0 * * * * *", async () => {
      if (this.Core.Players.length) {
        this.RunBackupPlayerData(`自动备份-${DateTime.now().toFormat("yyyy-MM-dd-HH-mm-ss")}`).catch(() => {});
      }
    });
    await this.cleanBackup();
    return this.tellraw(`@a`, [
      { text: `如果你正在进行大型项目的建设，可通过命令:\n`, color: "gold", bold: true },
      { text: "!!qb", color: "yellow" },
      { text: " make ", color: "aqua" },
      { text: "<备注信息>", color: "red" },
      { text: "\n来进行存档的备份", color: "aqua" }
    ]);
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
      for (let File of ServerFile) {
        if (new Date().getTime() - File.stats.mtimeMs > 86400000) {
          await fs.unlink(File.path);
        }
      }
    } else {
      let ServerFile = await fs.promises.readdir(this.wholeWorldDest);
      ServerFile = ServerFile.filter(a => /自动备份-/.test(a))
        .map(a => ({ stats: fs.statSync(this.wholeWorldDest + "/" + a), path: this.wholeWorldDest + "/" + a }))
        .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);
      for (let File of ServerFile) {
        if (new Date().getTime() - File.stats.mtimeMs > 86400000) {
          this.PluginLog("删除备份" + File.path);
          if (this.platform != "win32") {
            await runCommand(`bash -c 'rm -rf "${File.path}"'`).catch(a => "");
          } else {
            await runCommand(`rd /s /q "${File.path}"`).catch(a => "");
          }
        }
      }
    }
    return Promise.resolve();
  }
  Pause() {
    schedule.cancelJob(this.schedule);
    schedule.cancelJob(this.schedule2);
  }
}
module.exports = QuickBackup;
