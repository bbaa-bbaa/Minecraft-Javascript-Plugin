require('./.pnp.cjs').setup();
const PluginCore = require("./core/PluginCore");
const fs = require("fs-extra");
let Plugines = new PluginCore({
  BaseDir: "/home/bbaa/SCS",
  newVersion:true,
  isForge:true
});
let List = fs.readdirSync(__dirname + "/plugins");
for (let Constructor of List) {
  if(!/\.js$/.test(Constructor)) continue;
  Plugines.registerPlugin(require(__dirname + "/plugins/" + Constructor));
}
