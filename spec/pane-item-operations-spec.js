describe("incompatible-packages singleton pane operations", () => {
  let source;

  beforeEach(async () => {
    lumine.config.set("about.showOnStartup", false);
    await lumine.packages.activatePackage("incompatible-packages");
    jasmine.attachToDOM(lumine.workspace.getElement());
    source = await lumine.workspace.open("lumine://incompatible-packages");
  });

  afterEach(async () => {
    await lumine.packages.deactivatePackage("incompatible-packages");
  });

  it("silently skips copy and split-copy while preserving layout, pending state and focus", async () => {
    const pane = lumine.workspace.paneForItem(source);
    pane.setPendingItem(source);
    const panes = lumine.workspace.getPanes();
    const warnings = spyOn(lumine.notifications, "addWarning");
    const errors = spyOn(lumine.notifications, "addError");
    expect(source.canCopy()).toBe(false);
    expect(await lumine.workspace.copyPaneItem(source, { splitDirection: "right" })).toBeNull();
    for (const direction of ["up", "down", "left", "right"]) {
      await lumine.commands.dispatch(source.element, "pane:copy-active-item-" + direction);
      await lumine.commands.dispatch(
        source.element,
        "pane:split-" + direction + "-and-copy-active-item",
      );
    }
    expect(lumine.workspace.getPanes()).toEqual(panes);
    expect(lumine.workspace.getActivePane()).toBe(pane);
    expect(pane.getPendingItem()).toBe(source);
    expect(warnings).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
  });

  it("moves the same live view, reopens its existing resource and releases its key on unload", async () => {
    const root = lumine.views.getView(source);
    const moved = await lumine.workspace.movePaneItem(source, { splitDirection: "right" });
    expect(moved.item).toBe(source);
    expect(lumine.views.getView(source)).toBe(root);
    const count = lumine.workspace.getPanes().length;
    const reopened = await lumine.workspace.open("lumine://incompatible-packages", {
      split: "down",
    });
    expect(reopened).toBe(source);
    expect(lumine.workspace.getPanes().length).toBe(count);
    const key = source.getSingletonKey();
    await lumine.packages.deactivatePackage("incompatible-packages");
    expect(
      lumine.workspace.getPaneItems().filter((item) => item.getSingletonKey?.() === key),
    ).toEqual([]);
    await lumine.packages.activatePackage("incompatible-packages");
    const replacement = await lumine.workspace.open("lumine://incompatible-packages");
    expect(replacement).not.toBe(source);
    expect(replacement.getSingletonKey()).toBe(key);
  });
});
