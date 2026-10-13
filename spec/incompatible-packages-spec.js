const path = require("path");
const { createRequire } = require("node:module");
let IncompatiblePackagesComponent, StatusIconComponent;

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

function findStatusBarIcon(statusBar) {
  return statusBar
    .getRightTiles()
    .map((tile) => tile.getItem())
    .find((item) => item.element?.classList.contains("incompatible-packages-status"));
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
      const pack = await lumine.packages.activatePackage("incompatible-packages");
      const requireActive = createRequire(path.join(pack.path, "package.json"));
      IncompatiblePackagesComponent = requireActive("./lib/incompatible-packages-component");
      StatusIconComponent = requireActive("./lib/status-icon-component");

      await conditionPromise(() => findStatusBarIcon(statusBar));
    });

    it("adds an icon to the status bar", () => {
      const statusBarIcon = findStatusBarIcon(statusBar);
      expect(statusBarIcon.constructor).toBe(StatusIconComponent);
    });

    it("exposes the report in the context menu and leaves right-click free", () => {
      const element = findStatusBarIcon(statusBar).element;
      const menu = lumine.contextMenu.templateForElement(element);
      expect(menu.map((item) => item.command)).toEqual(["incompatible-packages:view"]);
      expect(menu[0].mouseBindingLabel).toBe("LMB");
      const [tooltip] = lumine.tooltips.findTooltips(element);
      expect(tooltip.options.keyBindingCommand).toBe("incompatible-packages:view");
      expect(tooltip.options.keyBindingExtra).toBeUndefined();
      expect(tooltip.getTitle()).toContain("Click to view the report.");
      const dispatch = spyOn(lumine.commands, "dispatch");
      element.dispatchEvent(new MouseEvent("click", { button: 2 }));
      expect(dispatch).not.toHaveBeenCalled();
      element.click();
      expect(dispatch).toHaveBeenCalledWith(element, menu[0].command);
    });

    describe("clicking the icon", () => {
      it("displays the incompatible packages view in a pane", async () => {
        const statusBarIcon = findStatusBarIcon(statusBar);
        statusBarIcon.element.dispatchEvent(new MouseEvent("click"));

        let activePaneItem;
        await conditionPromise(() => (activePaneItem = lumine.workspace.getActivePaneItem()));

        expect(activePaneItem.constructor).toBe(IncompatiblePackagesComponent);
      });

      it("closes the view when the package is deactivated", async () => {
        const statusBarIcon = findStatusBarIcon(statusBar);
        statusBarIcon.element.dispatchEvent(new MouseEvent("click"));
        let item;
        await conditionPromise(() => {
          item = lumine.workspace.getActivePaneItem();
          return item instanceof IncompatiblePackagesComponent;
        });

        await lumine.packages.deactivatePackage("incompatible-packages");

        expect(lumine.workspace.paneForItem(item)).toBeUndefined();
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
