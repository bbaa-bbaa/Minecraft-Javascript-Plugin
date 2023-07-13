require('./.pnp.cjs').setup();
const PluginCore = require("./core/PluginCore");
const fs = require("fs-extra");
let Plugines = new PluginCore({
  BaseDir: "/home/bbaa/MC_Eternal/",
  PluginSettings: {
    QuickBackup: {
      "backupDest": "/tmp/Minecraft-Backup",
      "tmpDir": "/tmp/Minecraft-Backup/tmp",
    }
  },
 // startCommand: "..\\Minecraft-Server\\start.bat",
  newVersion: false,
  isForge: true,

});
let List = fs.readdirSync(__dirname + "/plugins");
for (let Constructor of List) {
  if (!/\.js$/.test(Constructor)) continue;
  Plugines.registerPlugin(require(__dirname + "/plugins/" + Constructor));
}
