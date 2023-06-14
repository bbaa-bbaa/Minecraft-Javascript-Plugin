const BasePlugin = require("../core/basePlugin.js");
class DynView extends BasePlugin {
  static PluginName = "动态视距检测";
  constructor() {
    super(...arguments);
    this.SimView = 10;
    this.CView = 12;
  }
  init(Plugin) {
    return -1;
    Plugin.registerCommand("queryview", this.getView.bind(this));
    Plugin.registerNativeLogProcesser(
      /\[com.dynamic_view.DynView\/\]: Mean tick: (\d*)ms (increasing|decreasing) (chunk view distance|simulation distance) to: (\d*)/,
      this.saveView
    );
  }

  async Start() {}
  getView() {
    this.tellraw("@a", [
      { text: "当前服务器视野距离为: ", color: "yellow" },
      { text: this.CView, bold: true, color: "aqua" },
      { text: " 模拟距离为: ", color: "yellow" },
      { text: this.SimView, bold: true, color: "aqua" }
    ]);
  }
  async saveView(RawText) {
    let [_nouse,MSPT, method, mode, value] =
      /\[com.dynamic_view.DynView\/\]: Mean tick: (\d*)ms (increasing|decreasing) (chunk view distance|simulation distance) to: (\d*)/.exec(
        RawText
      );
    if (mode == "chunk view distance") {
      this.CView = Number(value);
    } else {
      this.SimView = Number(value);
    }
    this.tellraw("@a", [
      { text: `检测到服务器负载`, color: "yellow" },
      { text: method == "decreasing" ? `升高` : `降低`, bold: true, color: method == "decreasing" ? `red` : `green` },
      { text: `[当前负载:`, color: "aqua" },
      { text: Number(MSPT) * 2, color: method == "decreasing" ? `red` : `green`, bold: true },
      { text: `]，`, color: "aqua" },
      { text: method == "decreasing" ? `降低` : `提升`, color: method == "decreasing" ? `red` : `green`, bold: true },
      { text: mode == "chunk view distance" ? "视距至" : "模拟距离至", color: "yellow" },
      { text: value, bold: true, color: method == "decreasing" ? `red` : `green` },
      { text: "Chunk", color: "yellow" }
    ]);
  }
}
module.exports = DynView;
