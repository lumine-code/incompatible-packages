const { Disposable, CompositeDisposable } = require("lumine");
const VIEW_URI = require("./view-uri");
const etch = require("@lumine-code/etch");

// Etch holds its scheduler per copy of the library, and this package resolves
// its own copy — so the assignment the editor makes on core's copy never
// reaches it. Point it at the view registry before anything renders, or this
// package's DOM writes land on an animation frame of their own alongside the
// editor's and force a synchronous reflow.
etch.setScheduler(lumine.views);

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

function consumeStatusBar(statusBar) {
  const serviceDisposables = new CompositeDisposable();
  let disposed = false;
  let icon = null;
  let tile = null;
  let cancelCheck = () => {};

  // Compatibility checks walk and sometimes require every native dependency in
  // every loaded package. The status-bar service is published synchronously,
  // but this diagnostic is not needed to make the service usable. Let the
  // initial activation batch and first paint finish before doing that scan.
  const check = () => {
    if (disposed) return;

    try {
      let incompatibleCount = 0;
      for (let pack of lumine.packages.getLoadedPackages()) {
        if (!pack.isCompatible()) incompatibleCount++;
      }

      if (disposed || incompatibleCount === 0) return;

      icon = createIcon(incompatibleCount);
      // Warnings band, see packages/status-bar/README.md.
      tile = statusBar.addRightTile({ item: icon, priority: 720 });
      const iconElement = icon.element;
      const clickHandler = () => {
        lumine.commands.dispatch(iconElement, "incompatible-packages:view");
      };
      iconElement.addEventListener("click", clickHandler);
      serviceDisposables.add(
        lumine.tooltips.add(iconElement, {
          title: `${incompatibleCount} ${incompatibleCount === 1 ? "package is" : "packages are"} incompatible with this version of Lumine`,
          keyBindingCommand: "incompatible-packages:view",
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
  const IncompatiblePackagesComponent = require("./incompatible-packages-component");
  return new IncompatiblePackagesComponent(lumine.packages);
}

function createIcon(count) {
  const StatusIconComponent = require("./status-icon-component");
  return new StatusIconComponent({ count });
}

module.exports = {
  activate,
  deactivate,
  consumeStatusBar,
  deserializeIncompatiblePackagesComponent,
};
