const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

describe("native compatibility diagnostic boundaries", () => {
  let directory, optional, statusBar;

  beforeEach(async () => {
    jasmine.useRealClock();
    jasmine.attachToDOM(lumine.workspace.getElement());
    directory = fs.realpathSync.native(
      fs.mkdtempSync(path.join(os.tmpdir(), "native-report-owned-")),
    );
    fs.writeFileSync(
      path.join(directory, "package.json"),
      JSON.stringify({
        name: "optional-native-report-fixture",
        version: "1.0.0",
        main: "main.js",
        engines: { lumine: "^1.0.0" },
      }),
    );
    fs.writeFileSync(path.join(directory, "main.js"), "module.exports = {};\n");
    const dependency = path.join(directory, "node_modules", "unused-native");
    fs.mkdirSync(path.join(dependency, "build", "Release"), { recursive: true });
    fs.writeFileSync(
      path.join(dependency, "package.json"),
      '{"name":"unused-native","version":"1.0.0"}',
    );
    fs.writeFileSync(
      path.join(dependency, "build", "Release", "binding.node"),
      "Invalid native fixture.",
    );
    optional = await lumine.packages.activatePackage(directory);
    const status = await lumine.packages.activatePackage("status-bar");
    statusBar = status.mainModule.statusBar;
  });

  afterEach(async () => {
    await lumine.packages.unloadPackage("incompatible-packages");
    await lumine.packages.unloadPackage(optional.name);
    if (
      fs.realpathSync.native(path.dirname(directory)) !== fs.realpathSync.native(os.tmpdir()) ||
      !path.basename(directory).startsWith("native-report-owned-")
    )
      throw new Error("Unexpected native diagnostic fixture path");
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  });

  const icons = (bar) =>
    bar
      .getRightTiles()
      .filter((tile) =>
        tile.getItem()?.element?.classList.contains("incompatible-packages-status"),
      );

  it("does not load unused bindings during startup but finds them in the explicitly opened report", async () => {
    const inspect = spyOn(optional, "isCompatible").and.callThrough();
    await lumine.packages.activatePackage("incompatible-packages");
    await new Promise(setImmediate);

    expect(optional.mainActivated).toBeTrue();
    expect(inspect).not.toHaveBeenCalled();
    expect(icons(statusBar)).toEqual([]);
    const view = await lumine.workspace.open("lumine://incompatible-packages");
    await lumine.views.getNextUpdatePromise();
    expect(inspect).toHaveBeenCalled();
    expect(view.incompatiblePackages).toContain(optional);
    expect(optional.incompatibleModules[0].name).toBe("unused-native");
    expect(view.element.textContent).toContain("unused-native");
  });

  for (const phase of ["loadError", "activationError"]) {
    it(`reports a known ${phase} without inspecting optional native dependencies`, async () => {
      optional[phase] = Object.assign(new Error("Known native load failure"), {
        code: "ERR_DLOPEN_FAILED",
      });
      const inspect = spyOn(optional, "isCompatible").and.throwError("Unexpected startup scan");
      await lumine.packages.activatePackage("incompatible-packages");
      await new Promise(setImmediate);

      expect(inspect).not.toHaveBeenCalled();
      expect(icons(statusBar).length).toBe(1);
    });
  }
});
