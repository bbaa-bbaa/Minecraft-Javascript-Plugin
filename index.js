let PluginCore = require("./core/PluginCore");
const fs = require("fs-extra");
let FOA = new PluginCore({
  Rcon: { host: "127.0.0.1", port: 25575, password: "bbaa" },
  log: "/home/bbaa/FOA/logs/latest.log"
});
let List = fs.readdirSync(__dirname + "/plugins");
for (let Constructor of List) {
  FOA.registerPlugin(require(__dirname + "/plugins/" + Constructor));
}
