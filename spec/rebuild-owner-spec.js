describe("Incompatible package rebuild owner", () => {
  let view, pack, finishes, rebuilds;
  beforeEach(async () => {
    jasmine.attachToDOM(lumine.views.getView(lumine.workspace));
    await lumine.packages.activatePackage("incompatible-packages");
    finishes = [];
    pack = {
      name: "controlled-native-package",
      metadata: { version: "1.0.0" },
      incompatibleModules: [],
      isCompatible: () => false,
      getBuildFailureOutput: () => null,
      rebuild: jasmine.createSpy("controlled accepted rebuild").and.callFake(
        () =>
          new Promise((resolve) => {
            finishes.push(resolve);
          }),
      ),
    };
    const loaded = spyOn(lumine.packages, "getLoadedPackages").and.returnValue([pack]);
    view = await lumine.workspace.open("lumine://incompatible-packages");
    loaded.and.callThrough();
    rebuilds = spyOn(view, "rebuildIncompatiblePackages").and.callThrough();
    await lumine.views.getNextUpdatePromise();
  });
  afterEach(async () => {
    for (const finish of finishes) finish({ code: 0, stderr: "" });
    await Promise.all(rebuilds.calls.all().map((call) => call.returnValue));
    if (!view.destroyed) view.destroy();
    await lumine.packages.deactivatePackage("incompatible-packages");
  });
  it("settles an accepted rebuild after actual pane closure without updating a destroyed view", async () => {
    const rebuilding = view.rebuildIncompatiblePackages();
    expect(pack.rebuild).toHaveBeenCalledTimes(1);
    await lumine.workspace.paneForItem(view).destroyItem(view, { force: true });
    expect(view.destroyed).toBe(true);
    for (const finish of finishes) finish({ code: 0, stderr: "" });
    await expectAsync(rebuilding).toBeResolved();
  });
  it("ignores a duplicate click while the first real rebuild is still pending", async () => {
    view.refs.rebuildButton.click();
    const first = rebuilds.calls.first().returnValue;
    view.refs.rebuildButton.click();
    expect(pack.rebuild).toHaveBeenCalledTimes(1);
    for (const finish of finishes) finish({ code: 0, stderr: "" });
    await first;
    await Promise.all(rebuilds.calls.all().map((call) => call.returnValue));
  });
  it("still renders completion and counts for the live view", async () => {
    const rebuilding = view.rebuildIncompatiblePackages();
    for (const finish of finishes) finish({ code: 0, stderr: "" });
    await rebuilding;
    await lumine.views.getNextUpdatePromise();
    expect(view.rebuiltPackageCount).toBe(1);
    expect(view.rebuildInProgress).toBe(false);
    expect(view.element.textContent).toContain("1 of 1 packages were rebuilt successfully");
  });
});
