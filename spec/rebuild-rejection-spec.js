const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

describe("Incompatible Packages rejected rebuilds", () => {
  let view, directory, temporary, packs;
  beforeEach(async () => {
    jasmine.useRealClock();
    for (const method of ["openExternal", "openPath", "showItemInFolder", "openApplication"])
      spyOn(lumine.shell, method).and.resolveTo();
    spyOn(lumine.application, "openWindow").and.resolveTo();
    temporary = fs.realpathSync.native(os.tmpdir());
    directory = fs.realpathSync.native(fs.mkdtempSync(path.join(temporary, "rebuild-owned-")));
    packs = [];
    for (const name of ["owned-rebuild-first", "owned-rebuild-second"]) {
      const target = path.join(directory, name);
      fs.mkdirSync(target);
      fs.writeFileSync(
        path.join(target, "package.json"),
        JSON.stringify({ name, version: "1.0.0", main: "main.js", engines: { lumine: "^1.0.0" } }),
      );
      fs.writeFileSync(path.join(target, "main.js"), "module.exports = {};\n");
      const pack = lumine.packages.loadPackage(target);
      spyOn(pack, "isCompatible").and.returnValue(false);
      pack.incompatibleModules = [];
      spyOn(pack, "runRebuildProcess").and.callFake((finish) =>
        finish({ code: 0, stdout: "", stderr: "" }),
      );
      packs.push(pack);
    }
    jasmine.attachToDOM(lumine.workspace.getElement());
    await lumine.packages.activatePackage("incompatible-packages");
    spyOn(lumine.packages, "getLoadedPackages").and.returnValue(packs);
    view = await lumine.workspace.open("lumine://incompatible-packages");
    await lumine.views.getNextUpdatePromise();
  });
  afterEach(async () => {
    await view?.destroy();
    await lumine.packages.unloadPackage("incompatible-packages");
    for (const pack of packs) await lumine.packages.unloadPackage(pack.name);
    await lumine.fileWatchClient.settlePendingTeardown();
    if (
      path.dirname(fs.realpathSync.native(directory)) !== temporary ||
      !path.basename(directory).startsWith("rebuild-owned-")
    )
      throw Error("Unsafe rebuild fixture cleanup");
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  });
  it("reports a rejected real Package rebuild and still rebuilds the next package", async () => {
    packs[0].runRebuildProcess.and.throwError("Owned process construction failure");
    await expectAsync(view.rebuildIncompatiblePackages()).toBeResolved();
    await require("@lumine-code/etch").update(view);
    expect(packs[1].runRebuildProcess).toHaveBeenCalledTimes(1);
    expect(view.rebuildInProgress).toBe(false);
    expect(view.rebuiltPackageCount).toBe(1);
    expect(view.element.querySelector(".incompatible-package .badge").textContent).toBe(
      "Rebuild Failed",
    );
    expect(view.element.querySelector(".incompatible-package pre").textContent).toContain(
      "Owned process construction failure",
    );
  });
  it("allows an ordinary later retry after every first rebuild rejects", async () => {
    for (const pack of packs) pack.runRebuildProcess.and.throwError("Owned failed attempt");
    await expectAsync(view.rebuildIncompatiblePackages()).toBeResolved();
    await require("@lumine-code/etch").update(view);
    expect(view.refs.rebuildButton.disabled).toBe(false);
    for (const pack of packs)
      pack.runRebuildProcess.and.callFake((finish) => finish({ code: 0, stdout: "", stderr: "" }));
    await view.rebuildIncompatiblePackages();
    await require("@lumine-code/etch").update(view);
    expect(view.rebuiltPackageCount).toBe(2);
    expect(view.element.textContent).toContain("2 of 2");
  });
  it("keeps ordinary successful real Package rebuilds working", async () => {
    await view.rebuildIncompatiblePackages();
    await require("@lumine-code/etch").update(view);
    expect(view.rebuiltPackageCount).toBe(2);
    expect(view.rebuildInProgress).toBe(false);
    expect(view.element.textContent).toContain("2 of 2");
  });
});
