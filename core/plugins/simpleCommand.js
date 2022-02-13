let BasePlugin = require(__dirname+"/../basePlugin.js")
class simpleCommand extends BasePlugin {
  static PluginName = "简单命令"
  constructor(){
    super(...arguments)
    this.CommandList={};
  }
  init(Plugin) {
    Plugin.addPluginRegister(this.registerCommand);
    Plugin.registerNativeLogProcesser(/\[Server thread\/INFO\].*?\<(.*?)\>.*?!!(.*)/,this.ProcessCommand)
  }
  registerCommand(cmd,func,scope){
    if(this.CommandList[cmd]) return;
    this.CommandList[cmd]=func.bind(scope);
    console.log(`[${this.constructor.PluginName}]${scope.constructor.PluginName}注册了一个命令${cmd}`)
  }
  ProcessCommand(RawText){
    let [Other, Player, Commmand] = /\[Server thread\/INFO\]:.*?\<(.*?)\>.*?!!(.*)/.exec(
      RawText
    );
    let tmp = Commmand.split(" ");
    let Cmd = tmp.shift();
    let Args = tmp;
    Player = Player.replace(/§\w/g,"")
    if(this.CommandList[Cmd]){
      console.log(`玩家 ${Player} 执行 ${Cmd} ${Args.join(" ")}`)
      this.CommandList[Cmd](Player,...Args)
    }
  }
}
module.exports=simpleCommand
