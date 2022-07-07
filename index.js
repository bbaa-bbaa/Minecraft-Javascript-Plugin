require('./.pnp.cjs').setup();
const PluginCore = require("./core/PluginCore");
const fs = require("fs-extra");
let Plugines = new PluginCore({
  Rcon: { host: "127.0.0.1", port: 25575, password: "bbaa" },
  BaseDir: "/home/bbaa/Enigtech",
  newVersion:false
});
let List = fs.readdirSync(__dirname + "/plugins");
for (let Constructor of List) {
  if(!/\.js$/.test(Constructor)) continue;
  Plugines.registerPlugin(require(__dirname + "/plugins/" + Constructor));
}
