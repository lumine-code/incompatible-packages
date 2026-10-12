module.exports = function restoreCopiedScroll(view, scrollTop, scrollElement = view.element) {
  if (!scrollTop) return;
  view.pendingCopyScrollRestore?.dispose();
  const element = view.element;
  let finished = false;
  let frame;
  let commandSubscription;
  const events = ["keydown", "pointerdown", "wheel", "scroll"];
  const resource = {
    scrollTop,
    initialScrollTop: scrollElement.scrollTop,
    dispose() {
      if (finished) return;
      finished = true;
      if (frame != null) cancelAnimationFrame(frame);
      commandSubscription?.dispose();
      for (const name of events) element.removeEventListener(name, cancel, true);
      if (view.pendingCopyScrollRestore === resource) view.pendingCopyScrollRestore = null;
    },
  };
  const cancel = () => resource.dispose();
  view.pendingCopyScrollRestore = resource;
  commandSubscription = lumine.commands.onWillDispatch((event) => {
    const target = event.target;
    if (target === element || (target?.nodeType && element.contains(target))) cancel();
  });
  for (const name of events) element.addEventListener(name, cancel, true);
  frame = requestAnimationFrame(() => {
    if (finished) return;
    resource.dispose();
    if (!view.destroyed) scrollElement.scrollTop = scrollTop;
  });
};

module.exports.capture = function captureCopiedScroll(view, scrollElement = view.element) {
  const pending = view.pendingCopyScrollRestore;
  return pending && scrollElement.scrollTop === pending.initialScrollTop
    ? pending.scrollTop
    : scrollElement.scrollTop;
};
