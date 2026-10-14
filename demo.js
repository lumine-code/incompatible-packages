// Authentic package usage. Run with lumine/script/demo.js; fixtures stay in demo/.
module.exports = {
  version: 1,
  dependencies: [],
  viewport: { width: 1100, height: 340 },
  async before() {},
  async prepare(context) {
    const { state, open } = context;
    state.editor = await open("signal.js");
  },
  scenes: [
    {
      id: "scene-1",
      file: "demo.png",
      caption: "The incompatible-packages view in Lumine.",
      timeout: 60000,
      async run(context) {
        const { lumine, state } = context;
        {
          lumine.commands.dispatch(
            lumine.views.getView(state.editor),
            "incompatible-packages:view",
          );
        }
      },
      ready(context) {
        const { lumine, state } = context;
        return Boolean(lumine.workspace.getActivePaneItem() !== state.editor);
      },
    },
  ],
  async cleanup() {},
};
