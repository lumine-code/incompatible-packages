const path = require("path");
const IncompatiblePackagesComponent = require("../lib/incompatible-packages-component");
const StatusIconComponent = require("../lib/status-icon-component");

// Falls back to the bottom panels when no footer panel holds the status bar.
function findStatusBar() {
  if (typeof lumine.workspace.getFooterPanels === "function") {
    const footerPanels = lumine.workspace.getFooterPanels();
    if (footerPanels.length > 0) {
      return footerPanels[0].getItem();
    }
  }

  return lumine.workspace.getBottomPanels()[0].getItem();
}

describe("Incompatible packages", () => {
  let statusBar;

  beforeEach(async () => {
    lumine.views.getView(lumine.workspace);

    await lumine.packages.activatePackage("status-bar");

    statusBar = findStatusBar();
  });

  describe("when there are packages with incompatible native modules", () => {
    beforeEach(async () => {
      let incompatiblePackage = lumine.packages.loadPackage(
        path.join(__dirname, "fixtures", "incompatible-package"),
      );
      spyOn(incompatiblePackage, "isCompatible").and.returnValue(false);
      incompatiblePackage.incompatibleModules = [];
      await lumine.packages.activatePackage("incompatible-packages");

      await timeoutPromise(1);
    });

    it("adds an icon to the status bar", () => {
      let statusBarIcon = statusBar.getRightTiles()[0].getItem();
      expect(statusBarIcon.constructor).toBe(StatusIconComponent);
    });

    describe("clicking the icon", () => {
      it("displays the incompatible packages view in a pane", async () => {
        let statusBarIcon = statusBar.getRightTiles()[0].getItem();
        statusBarIcon.element.dispatchEvent(new MouseEvent("click"));

        let activePaneItem;
        await conditionPromise(() => (activePaneItem = lumine.workspace.getActivePaneItem()));

        expect(activePaneItem.constructor).toBe(IncompatiblePackagesComponent);
      });
    });
  });

  describe("when there are no packages with incompatible native modules", () => {
    beforeEach(async () => {
      await lumine.packages.activatePackage("incompatible-packages");
    });

    it("does not add an icon to the status bar", () => {
      let statusBarItemClasses = statusBar.getRightTiles().map((tile) => tile.getItem().className);

      expect(statusBarItemClasses).not.toContain("incompatible-packages");
    });
  });
});
