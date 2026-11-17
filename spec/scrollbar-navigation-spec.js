describe("incompatible package report scrollbar navigation", () => {
  let view, bind;

  beforeEach(() => {
    bind = spyOn(lumine.scrollbars, "bindNavigation").and.callThrough();
    const Component = require("../lib/incompatible-packages-component");
    view = new Component(lumine.packages, {
      state: {
        views: new Set(),
        rebuildStatuses: new Map(),
        rebuildFailureOutputs: new Map(),
        rebuildInProgress: false,
        rebuiltPackageCount: 0,
        loaded: false,
        incompatiblePackages: [],
        populateHandle: null,
      },
    });
    jasmine.attachToDOM(view.element);
  });

  afterEach(() => view.destroy());

  it("keeps one navigation owner when loading changes to the report", async () => {
    const scrollport = view.element;
    view.loaded = true;
    await view.updateViews();
    expect(view.element).toBe(scrollport);
    expect(bind).toHaveBeenCalledOnceWith(scrollport);
    const reveal = spyOn(lumine.scrollbars, "reveal");
    lumine.commands.dispatch(scrollport, "core:page-down");
    expect(reveal).toHaveBeenCalledOnceWith(scrollport);
    reveal.calls.reset();
    await view.updateViews();
    expect(reveal).not.toHaveBeenCalled();
  });

  it("disposes the report's commands and scoped bindings", () => {
    const binding = bind.calls.mostRecent().returnValue;
    view.destroy();
    expect(binding.disposed).toBeTrue();
    expect(view.element.hasAttribute("data-lumine-scroll-navigation")).toBeFalse();
  });
});
