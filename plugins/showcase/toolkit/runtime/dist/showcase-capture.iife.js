"use strict";
(() => {
  // toolkit/runtime/src/capture.ts
  var KEY = "__showcaseNatives";
  function setterOf(proto, name) {
    return Object.getOwnPropertyDescriptor(proto, name)?.set ?? null;
  }
  function captureNatives(win = window) {
    const held = win[KEY];
    if (held) return held;
    const n = {
      dateNow: win.Date.now.bind(win.Date),
      perfNow: win.performance.now.bind(win.performance),
      timeOrigin: win.performance.timeOrigin,
      setTimeout: win.setTimeout.bind(win),
      clearTimeout: win.clearTimeout.bind(win),
      setInterval: win.setInterval.bind(win),
      clearInterval: win.clearInterval.bind(win),
      requestAnimationFrame: win.requestAnimationFrame.bind(win),
      cancelAnimationFrame: win.cancelAnimationFrame.bind(win),
      setters: {
        inputValue: setterOf(win.HTMLInputElement.prototype, "value"),
        textareaValue: setterOf(win.HTMLTextAreaElement.prototype, "value"),
        selectValue: setterOf(win.HTMLSelectElement.prototype, "value"),
        checked: setterOf(win.HTMLInputElement.prototype, "checked")
      },
      MutationObserver: win.MutationObserver
    };
    Object.defineProperty(win, KEY, { value: n, configurable: false, enumerable: false, writable: false });
    return n;
  }
  function isTopFrame(win = window) {
    try {
      return win.top === win;
    } catch {
      return false;
    }
  }

  // toolkit/runtime/src/capture-inject.ts
  if (isTopFrame()) captureNatives();
})();
