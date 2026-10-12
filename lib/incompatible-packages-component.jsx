/** @jsx etch.dom */
const etch = require("@lumine-code/etch");

const VIEW_URI = require("./view-uri");
const REBUILDING = "rebuilding";
const REBUILD_FAILED = "rebuild-failed";
const REBUILD_SUCCEEDED = "rebuild-succeeded";

module.exports = class IncompatiblePackagesComponent {
  constructor(packageManager, { state } = {}) {
    this.state = state || {
      views: new Set(),
      rebuildStatuses: new Map(),
      rebuildFailureOutputs: new Map(),
      rebuildInProgress: false,
      rebuiltPackageCount: 0,
      loaded: false,
      incompatiblePackages: [],
      populateHandle: null,
    };
    for (const name of [
      "rebuildStatuses",
      "rebuildFailureOutputs",
      "rebuildInProgress",
      "rebuiltPackageCount",
      "loaded",
      "incompatiblePackages",
      "populateHandle",
    ]) {
      Object.defineProperty(this, name, {
        get: () => this.state[name],
        set: (value) => {
          this.state[name] = value;
        },
      });
    }
    this.state.views.add(this);
    this.packageManager = packageManager;
    etch.initialize(this);

    if (state) {
      // The new surface observes the existing work without starting it again.
    } else if (this.packageManager.getActivePackages().length > 0) {
      this.populateIncompatiblePackages();
    } else {
      this.populateHandle = global.setImmediate(() => {
        this.populateHandle = null;
        this.state.views.values().next().value?.populateIncompatiblePackages();
      });
    }

    this.handleClick = (event) => {
      if (event.target === this.refs.rebuildButton) {
        this.rebuildIncompatiblePackages();
      } else if (event.target === this.refs.reloadButton) {
        lumine.window.reload();
      } else if (event.target.classList.contains("view-settings")) {
        lumine.workspace.open(`lumine://config/packages/${event.target.package.name}`);
      }
    };
    this.element.addEventListener("click", this.handleClick);
  }

  update() {}

  copy({ signal } = {}) {
    signal?.throwIfAborted();
    const copy = new IncompatiblePackagesComponent(this.packageManager, { state: this.state });
    const scrollTop = this.element.scrollTop;
    const initialScrollTop = copy.element.scrollTop;
    requestAnimationFrame(() => {
      if (!copy.destroyed && copy.element.scrollTop === initialScrollTop)
        copy.element.scrollTop = scrollTop;
    });
    return copy;
  }

  updateViews() {
    return Promise.all(Array.from(this.state.views, (view) => etch.update(view)));
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.state.views.delete(this);
    if (this.state.views.size === 0 && this.populateHandle != null) {
      global.clearImmediate(this.populateHandle);
      this.populateHandle = null;
    }
    this.element?.removeEventListener("click", this.handleClick);
    return etch.destroy(this);
  }

  render() {
    if (!this.loaded) {
      return <div className="incompatible-packages padded">Loading...</div>;
    }

    return (
      <div className="incompatible-packages padded native-key-bindings" tabIndex="-1">
        {this.renderHeading()}
        {this.renderIncompatiblePackageList()}
      </div>
    );
  }

  renderHeading() {
    if (this.incompatiblePackages.length > 0) {
      if (this.rebuiltPackageCount > 0) {
        let alertClass =
          this.rebuiltPackageCount === this.incompatiblePackages.length
            ? "alert-success icon-check"
            : "alert-warning icon-bug";

        return (
          <div className={"alert icon " + alertClass}>
            {this.rebuiltPackageCount} of {this.incompatiblePackages.length} packages were rebuilt
            successfully. Reload Lumine to activate them.
            <button ref="reloadButton" className="btn pull-right">
              Reload Lumine
            </button>
          </div>
        );
      } else {
        return (
          <div className="alert alert-danger icon icon-bug">
            Some installed packages could not be loaded because they contain native modules that
            were compiled for an earlier version of Lumine.
            <button
              ref="rebuildButton"
              className="btn pull-right"
              disabled={this.rebuildInProgress}
            >
              Rebuild Packages
            </button>
          </div>
        );
      }
    } else {
      return (
        <div className="alert alert-success icon icon-check">
          None of your packages contain incompatible native modules.
        </div>
      );
    }
  }

  renderIncompatiblePackageList() {
    return <div>{this.incompatiblePackages.map(this.renderIncompatiblePackage.bind(this))}</div>;
  }

  renderIncompatiblePackage(pack) {
    let rebuildStatus = this.rebuildStatuses.get(pack);

    return (
      <div className={"incompatible-package"}>
        {this.renderRebuildStatusIndicator(rebuildStatus)}
        <button className="btn view-settings icon icon-gear pull-right" package={pack}>
          Package Settings
        </button>
        <h4 className="heading">
          {pack.name} {pack.metadata.version}
        </h4>
        {rebuildStatus ? this.renderRebuildOutput(pack) : this.renderIncompatibleModules(pack)}
      </div>
    );
  }

  renderRebuildStatusIndicator(rebuildStatus) {
    if (rebuildStatus === REBUILDING) {
      return <div className="badge badge-info pull-right icon icon-gear">Rebuilding</div>;
    } else if (rebuildStatus === REBUILD_SUCCEEDED) {
      return (
        <div className="badge badge-success pull-right icon icon-check">Rebuild Succeeded</div>
      );
    } else if (rebuildStatus === REBUILD_FAILED) {
      return <div className="badge badge-error pull-right icon icon-x">Rebuild Failed</div>;
    } else {
      return "";
    }
  }

  renderRebuildOutput(pack) {
    if (this.rebuildStatuses.get(pack) === REBUILD_FAILED) {
      return <pre>{this.rebuildFailureOutputs.get(pack)}</pre>;
    } else {
      return "";
    }
  }

  renderIncompatibleModules(pack) {
    return (
      <ul>
        {pack.incompatibleModules.map((nativeModule) => (
          <li>
            <div className="icon icon-file-binary">
              {nativeModule.name}@{nativeModule.version || "unknown"} –{" "}
              <span className="text-warning">{nativeModule.error}</span>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  populateIncompatiblePackages() {
    this.incompatiblePackages = this.packageManager
      .getLoadedPackages()
      .filter((pack) => !pack.isCompatible());

    for (let pack of this.incompatiblePackages) {
      let buildFailureOutput = pack.getBuildFailureOutput();
      if (buildFailureOutput) {
        this.setPackageStatus(pack, REBUILD_FAILED);
        this.setRebuildFailureOutput(pack, buildFailureOutput);
      }
    }

    this.loaded = true;
    this.updateViews();
  }

  async rebuildIncompatiblePackages() {
    if (this.destroyed || this.rebuildInProgress) return;
    this.rebuildInProgress = true;
    let rebuiltPackageCount = 0;
    try {
      for (let pack of this.incompatiblePackages) {
        this.setPackageStatus(pack, REBUILDING);
        let result;
        try {
          result = await pack.rebuild();
        } catch (error) {
          this.setRebuildFailureOutput(pack, error?.message ?? String(error));
          this.setPackageStatus(pack, REBUILD_FAILED);
          continue;
        }
        if (result.code === 0) {
          this.setPackageStatus(pack, REBUILD_SUCCEEDED);
          rebuiltPackageCount++;
        } else {
          this.setRebuildFailureOutput(pack, result.stderr);
          this.setPackageStatus(pack, REBUILD_FAILED);
        }
      }
    } finally {
      this.rebuildInProgress = false;
      this.rebuiltPackageCount = rebuiltPackageCount;
      this.updateViews();
    }
  }

  setPackageStatus(pack, status) {
    this.rebuildStatuses.set(pack, status);
    this.updateViews();
  }

  setRebuildFailureOutput(pack, output) {
    this.rebuildFailureOutputs.set(pack, output);
    this.updateViews();
  }

  getTitle() {
    return "Incompatible Packages";
  }

  getURI() {
    return VIEW_URI;
  }

  getIconName() {
    return "package";
  }

  serialize() {
    return { deserializer: "IncompatiblePackagesComponent" };
  }
};
