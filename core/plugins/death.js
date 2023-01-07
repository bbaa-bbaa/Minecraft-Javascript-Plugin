let BasePlugin = require("../basePlugin.js");
class DeathCount extends BasePlugin {
  static PluginName = "死亡计数";
  constructor() {
    super(...arguments);
  }
  init(Plugin) {
    Plugin.registerNativeLogProcesser(/\]: ([^ ]+? fell off a ladder|[^ ]+? fell off some vines|[^ ]+? fell off some weeping vines|[^ ]+? fell off some twisting vines|[^ ]+? fell off scaffolding|[^ ]+? fell while climbing|[^ ]+? fell from a high place|[^ ]+? was doomed to fall|[^ ]+? was doomed to fall by [^ ]+?|[^ ]+? was doomed to fall by [^ ]+? using [^ ]+?|[^ ]+? fell too far and was finished by [^ ]+?|[^ ]+? fell too far and was finished by [^ ]+? using [^ ]+?|[^ ]+? was struck by lightning|[^ ]+? was struck by lightning whilst fighting [^ ]+?|[^ ]+? went up in flames|[^ ]+? walked into fire whilst fighting [^ ]+?|[^ ]+? burned to death|[^ ]+? was burnt to a crisp whilst fighting [^ ]+?|[^ ]+? tried to swim in lava|[^ ]+? tried to swim in lava to escape [^ ]+?|[^ ]+? discovered the floor was lava|[^ ]+? walked into danger zone due to [^ ]+?|[^ ]+? suffocated in a wall|[^ ]+? suffocated in a wall whilst fighting [^ ]+?|[^ ]+? was squished too much|[^ ]+? was squashed by [^ ]+?|[^ ]+? drowned|[^ ]+? drowned whilst trying to escape [^ ]+?|[^ ]+? starved to death|[^ ]+? starved to death whilst fighting [^ ]+?|[^ ]+? was pricked to death|[^ ]+? walked into a cactus whilst trying to escape [^ ]+?|[^ ]+? died|[^ ]+? died because of [^ ]+?|[^ ]+? blew up|[^ ]+? was blown up by [^ ]+?|[^ ]+? was blown up by [^ ]+? using [^ ]+?|[^ ]+? was killed by magic|[^ ]+? was killed by magic whilst trying to escape [^ ]+?|[^ ]+? was killed by even more magic|%s|[^ ]+? withered away|[^ ]+? withered away whilst fighting [^ ]+?|[^ ]+? was shot by a skull from [^ ]+?|[^ ]+? was squashed by a falling anvil|[^ ]+? was squashed by a falling anvil whilst fighting [^ ]+?|[^ ]+? was squashed by a falling block|[^ ]+? was squashed by a falling block whilst fighting [^ ]+?|[^ ]+? was slain by [^ ]+?|[^ ]+? was slain by [^ ]+? using [^ ]+?|[^ ]+? was slain by [^ ]+?|[^ ]+? was slain by [^ ]+? using [^ ]+?|[^ ]+? was shot by [^ ]+?|[^ ]+? was shot by [^ ]+? using [^ ]+?|[^ ]+? was fireballed by [^ ]+?|[^ ]+? was fireballed by [^ ]+? using [^ ]+?|[^ ]+? was pummeled by [^ ]+?|[^ ]+? was pummeled by [^ ]+? using [^ ]+?|[^ ]+? was killed by [^ ]+? using magic|[^ ]+? was killed by [^ ]+? using [^ ]+?|[^ ]+? was killed trying to hurt [^ ]+?|[^ ]+? was killed by [^ ]+? trying to hurt [^ ]+?|[^ ]+? was impaled by [^ ]+?|[^ ]+? was impaled by [^ ]+? with [^ ]+?|[^ ]+? hit the ground too hard|[^ ]+? hit the ground too hard whilst trying to escape [^ ]+?|[^ ]+? fell out of the world|[^ ]+? didn't want to live in the same world as [^ ]+?|[^ ]+? was roasted in dragon breath|[^ ]+? was roasted in dragon breath by [^ ]+?|[^ ]+? experienced kinetic energy|[^ ]+? experienced kinetic energy whilst trying to escape [^ ]+?|[^ ]+? went off with a bang|[^ ]+? went off with a bang whilst fighting [^ ]+?|[^ ]+? went off with a bang due to a firework fired from [^ ]+? by [^ ]+?|[^ ]+? was killed by [^ ]+?|[^ ]+? was poked to death by a sweet berry bush|[^ ]+? was poked to death by a sweet berry bush whilst trying to escape [^ ]+?|[^ ]+? was stung to death|[^ ]+? was stung to death by [^ ]+?)/,this.deathEvent);
  }
  deathEvent(line){
    let PlayerName=line.split("]: ")[1].split(" ")[0];
    this.updateBackPositionDatabase(PlayerName);
  }
  async Start() {
    await this.Scoreboard.ensureScoreboard({ name: "Death", type: "deathCount", displayname: "死亡次数" });
    await this.Scoreboard.displayScoreboard("Death", "sidebar");
  }
}
module.exports = DeathCount;
