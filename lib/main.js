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

function deactivate() {
  disposables.dispose();
}

function consumeStatusBar(statusBar) {
  let incompatibleCount = 0;
  for (let pack of lumine.packages.getLoadedPackages()) {
    if (!pack.isCompatible()) incompatibleCount++;
  }

  if (incompatibleCount > 0) {
    let icon = createIcon(incompatibleCount);
    // Warnings band, see packages/status-bar/README.md.
    let tile = statusBar.addRightTile({ item: icon, priority: 720 });
    icon.element.addEventListener("click", () => {
      lumine.commands.dispatch(icon.element, "incompatible-packages:view");
    });
    disposables.add(
      lumine.tooltips.add(icon.element, {
        title: `${incompatibleCount} ${incompatibleCount === 1 ? "package is" : "packages are"} incompatible with this version of Lumine`,
        keyBindingCommand: "incompatible-packages:view",
      }),
      new Disposable(() => tile.destroy()),
    );
  }
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
