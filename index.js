let PluginCore = require("./core/PluginCore");
const fs = require("fs-extra");
global.FOA = new PluginCore({
  Rcon: { host: "127.0.0.1", port: 25575, password: "zyg" },
  BaseDir: "/home/bbaa/mc118/",
  newVersion:true
});
let List = fs.readdirSync(__dirname + "/plugins");
for (let Constructor of List) {
  FOA.registerPlugin(require(__dirname + "/plugins/" + Constructor));
}
