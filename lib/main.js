const { Disposable, CompositeDisposable } = require("lumine");
const VIEW_URI = require("./view-uri");

let disposables = null;

function activate() {
  disposables = new CompositeDisposable();

  disposables.add(
    lumine.workspace.addOpener((uri) => {
      if (uri === VIEW_URI) {
        return deserializeIncompatiblePackagesComponent();
      }
    }),
  );

  disposables.add(
    lumine.commands.add("lumine-workspace", {
      "incompatible-packages:view": () => {
        lumine.workspace.open(VIEW_URI);
      },
    }),
  );
}

async function deactivate() {
  disposables?.dispose();
  disposables = null;
  const closures = [];
  for (const item of lumine.workspace.getPaneItems()) {
    if (item?.getURI?.() !== VIEW_URI) continue;
    const pane = lumine.workspace.paneForItem(item);
    if (pane) closures.push(pane.destroyItem(item, true));
    else item.destroy?.();
  }
  await Promise.all(closures);
}

function consumeStatusBar(service) {
  return service.observeWindows((scopedStatusBar, context) =>
    consumeWindowStatusBar.call(this, scopedStatusBar, context),
  );
}

function consumeWindowStatusBar(statusBar, _context) {
  const serviceDisposables = new CompositeDisposable();
  let disposed = false;
  let icon = null;
  let tile = null;
  let cancelCheck = () => {};

  // Startup only reports known failures. Scanning all native dependencies is
  // an explicit diagnostic owned by the report, not background startup work.
  const check = () => {
    if (disposed) return;

    try {
      let incompatibleCount = 0;
      for (let pack of lumine.packages.getLoadedPackages()) {
        if (
          pack.compatible === false ||
          pack.loadError?.code === "ERR_DLOPEN_FAILED" ||
          pack.activationError?.code === "ERR_DLOPEN_FAILED"
        )
          incompatibleCount++;
      }

      if (disposed || incompatibleCount === 0) return;

      icon = createIcon(incompatibleCount);
      // Warnings band, see packages/status-bar/README.md.
      tile = statusBar.addRightTile({ item: icon, priority: 720 });
      const iconElement = icon.element;
      iconElement.setAttribute("data-context-menu-boundary", "");
      const clickHandler = (event) => {
        if (event.button !== 0 || (process.platform === "darwin" && event.ctrlKey)) return;
        lumine.commands.dispatch(iconElement, "incompatible-packages:view");
      };
      iconElement.addEventListener("click", clickHandler);
      serviceDisposables.add(
        lumine.tooltips.add(iconElement, {
          title: `${incompatibleCount} incompatible ${incompatibleCount === 1 ? "package" : "packages"}. Click to view the report.`,
          html: false,
          keyBindingCommand: "incompatible-packages:view",
          keyBindingTarget: lumine.workspace.getMainWindow().getElement(),
        }),
        new Disposable(() => iconElement.removeEventListener("click", clickHandler)),
      );
    } catch (error) {
      tile?.destroy();
      tile = null;
      icon = null;
      console.error("Failed to check package compatibility", error);
    }
  };

  if (typeof setImmediate === "function") {
    const handle = setImmediate(check);
    cancelCheck = () => clearImmediate(handle);
  } else {
    const handle = setTimeout(check, 0);
    cancelCheck = () => clearTimeout(handle);
  }

  serviceDisposables.add(
    new Disposable(() => {
      disposed = true;
      cancelCheck();
      cancelCheck = () => {};
      tile?.destroy();
      tile = null;
      icon = null;
    }),
  );
  return serviceDisposables;
}

function deserializeIncompatiblePackagesComponent() {
  require("@lumine-code/etch").setScheduler(lumine.views);
  const IncompatiblePackagesComponent = require("./incompatible-packages-component");
  return new IncompatiblePackagesComponent(lumine.packages);
}

function createIcon(count) {
  require("@lumine-code/etch").setScheduler(lumine.views);
  const StatusIconComponent = require("./status-icon-component");
  return new StatusIconComponent({ count });
}

module.exports = {
  activate,
  deactivate,
  consumeStatusBar,
  deserializeIncompatiblePackagesComponent,
};
