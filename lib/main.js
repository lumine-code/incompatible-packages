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
    disposables.add(new Disposable(() => tile.destroy()));
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
