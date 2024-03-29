const BasePlugin = require("../basePlugin.js")
class simpleCommand extends BasePlugin {
  static PluginName = "简单命令"
  constructor(){
    super(...arguments)
    this.CommandList={};
  }
  init(Plugin) {
    Plugin.addPluginRegister(this.registerCommand);
    Plugin.registerNativeLogProcesser(/.*?\].*?\<(.*?)\>.*?!!(.*)/,this.ProcessCommand)
  }
  registerCommand(cmd,func,scope){
    if(this.CommandList[cmd]) return;
    this.CommandList[cmd]=func.bind(scope);
    this.PluginLog(`${scope.constructor.PluginName}注册了一个命令${cmd}`)
  }
  ProcessCommand(RawText){
    let [Other, Player, Commmand] = /.*?\]:.*?\<(.*?)\>.*?!!(.*)/.exec(
      RawText
    );
    let tmp = Commmand.split(" ");
    let Cmd = tmp.shift();
    let Args = tmp;
    Player = Player.replace(/§\w/g,"")
    if(this.CommandList[Cmd]){
      this.PluginLog(`玩家 ${Player} 执行 ${Cmd} ${Args.join(" ")}`)
      this.CommandList[Cmd](Player,...Args)
    }
  }
}
module.exports=simpleCommand
