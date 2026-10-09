// A prototype of the overlay the spikes test (PLAN §2.1 "Overlay"). Evidence only: Session 5
// builds the real one. Injected with addInitScript; `__OPTS__` is replaced by the harness.
//   mode:  "popover" — <showcase-overlay popover="manual"> with a shadow root, attached to <html>
//          "portal"  — Compass's design: a plain layer moved into the topmost open modal dialog
//   stop:  "host"    — pointer and focus events stop at the host, in the bubble phase
//          "window"  — a window capture listener (registered before any app code) consumes them
//          "none"    — no stopping
//   raise: re-show the popover on every top-layer change (showModal, popovers, full screen)
//   controls: "inline" — the control bar lives in the overlay
//             "portal" — the hybrid: the bar moves into the topmost open modal dialog or the
//                        fullscreen element (where the rest of the page is inert), else stays inline
//             "portal+popover" — also into the app's topmost open auto popover, so a click on the
//                        controls counts as inside it and doesn't light-dismiss it
(() => {
  if (window.top !== window) return; // top frame only (D16)
  const opts = __OPTS__;
  const counts = { pause: 0, next: 0, raises: 0 };
  const CSS = `
    :host { all: initial; position: fixed; inset: 0; width: 100vw; height: 100vh; margin: 0; padding: 0;
      border: 0; background: transparent; overflow: visible; pointer-events: none; z-index: 2147483647; display: block; }
    .layer { position: absolute; inset: 0; pointer-events: none; }
    .pointer { position: absolute; left: -16px; top: -16px; width: 26px; height: 26px; border-radius: 50%;
      background: #ff00ff; border: 3px solid #fff; box-shadow: 0 2px 8px rgb(0 0 0 / 0.5); }
    .spot { position: absolute; display: none; border: 4px solid #00ff88; border-radius: 10px; }
    .bar { position: absolute; left: 50%; bottom: 130px; transform: translateX(-50%); display: flex; gap: 8px;
      align-items: center; padding: 10px 14px; background: #ffd400; color: #111; border-radius: 12px;
      font: 600 15px system-ui, sans-serif; pointer-events: auto; box-shadow: 0 4px 16px rgb(0 0 0 / 0.5); }
    .bar button { all: unset; background: #111; color: #fff; padding: 6px 14px; border-radius: 8px; cursor: pointer; }
  `;

  const host = document.createElement("showcase-overlay");
  if (opts.mode === "popover") host.setAttribute("popover", "manual");
  const root = host.attachShadow({ mode: "open" });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(CSS);
  root.adoptedStyleSheets = [sheet];
  root.innerHTML = `<div class="layer"><div class="spot"></div><div class="pointer"></div></div>`;
  // The controls get their own host, so the hybrid can move them on their own.
  const ctlHost = document.createElement("showcase-controls");
  const croot = ctlHost.attachShadow({ mode: "open" });
  croot.adoptedStyleSheets = [sheet];
  croot.innerHTML = `<div class="bar" role="toolbar" aria-label="Tour controls"><button data-c="pause">Pause</button><button data-c="next">Next</button><span class="count">0</span></div>`;
  root.append(ctlHost);
  const pointer = root.querySelector(".pointer");
  const spot = root.querySelector(".spot");
  const bar = croot.querySelector(".bar");
  const countEl = croot.querySelector(".count");
  let px = innerWidth / 2;
  let py = innerHeight / 2;
  pointer.style.transform = `translate(${px}px, ${py}px)`;

  function control(path) {
    const b = path.find((n) => n instanceof HTMLElement && n.dataset && n.dataset.c);
    if (!b) return;
    counts[b.dataset.c]++;
    countEl.textContent = String(counts.pause + counts.next);
  }

  // The controls never take focus.
  bar.addEventListener("mousedown", (e) => e.preventDefault());
  const TYPES = ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "dblclick", "auxclick", "contextmenu", "focusin", "focusout", "touchstart", "touchend"];
  if (opts.stop === "window") {
    for (const type of TYPES) {
      window.addEventListener(type, (e) => {
        const path = e.composedPath();
        if (!path.includes(host) && !path.includes(ctlHost)) return;
        if (type === "mousedown") e.preventDefault();
        if (type === "click") control(path);
        e.stopImmediatePropagation();
      }, true);
    }
  } else {
    bar.addEventListener("click", (e) => control(e.composedPath()));
    if (opts.stop === "host") {
      for (const type of TYPES) {
        host.addEventListener(type, (e) => e.stopPropagation());
        ctlHost.addEventListener(type, (e) => e.stopPropagation());
      }
    }
  }

  function topmostModal() {
    const open = [...document.querySelectorAll("dialog[open]")].filter((d) => d.matches(":modal"));
    return open.at(-1) ?? null;
  }
  let autoOrder = [];
  function topmostAutoPopover() {
    const open = [...document.querySelectorAll("[popover]")].filter(
      (p) => p !== host && p.matches(":popover-open") && (p.getAttribute("popover") || "auto") === "auto",
    );
    autoOrder = [...autoOrder.filter((p) => open.includes(p)), ...open.filter((p) => !autoOrder.includes(p))];
    return autoOrder.at(-1) ?? null;
  }
  function placeControls() {
    if (opts.controls !== "portal" && opts.controls !== "portal+popover") return;
    const target = document.fullscreenElement ?? topmostModal() ?? (opts.controls === "portal+popover" ? topmostAutoPopover() : null);
    const want = target ?? root;
    if (ctlHost.parentNode !== want) want.append(ctlHost);
  }

  function raise() {
    placeControls();
    if (opts.mode !== "popover" || !opts.raise) return;
    if (!host.isConnected) attach();
    try {
      if (host.matches(":popover-open")) host.hidePopover();
      host.showPopover();
      counts.raises++;
    } catch {}
  }

  // Compass's portal: the topmost open modal dialog, else <body>.
  let order = [];
  function portalTarget() {
    const open = [...document.querySelectorAll("dialog[open]")].filter((d) => d.matches(":modal"));
    const known = order.filter((d) => open.includes(d));
    order = [...known, ...open.filter((d) => !known.includes(d))];
    return order.at(-1) ?? document.body;
  }

  function attach() {
    if (opts.mode === "portal") {
      const target = portalTarget();
      if (target && host.parentNode !== target) target.append(host);
      return;
    }
    if (!document.documentElement) return;
    if (host.parentNode !== document.documentElement) document.documentElement.append(host);
    try { if (!host.matches(":popover-open")) host.showPopover(); } catch {}
  }

  const observer = new MutationObserver(() => {
    placeControls();
    if (opts.mode === "portal") attach();
    else if (!host.isConnected) raise();
  });
  function arm() {
    attach();
    observer.observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] });
  }
  if (document.documentElement && (opts.mode === "popover" || document.body)) arm();
  else document.addEventListener("DOMContentLoaded", arm, { once: true });
  if (opts.mode === "popover" && !document.documentElement) {
    new MutationObserver((_, o) => { if (document.documentElement) { o.disconnect(); arm(); } }).observe(document, { childList: true });
  }

  // Staying on top: patch the top-layer entry points and watch the events.
  const showModal = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function (...a) { const r = showModal.apply(this, a); raise(); return r; };
  const showPopover = HTMLElement.prototype.showPopover;
  HTMLElement.prototype.showPopover = function (...a) { const r = showPopover.apply(this, a); if (this !== host) raise(); return r; };
  const requestFullscreen = Element.prototype.requestFullscreen;
  Element.prototype.requestFullscreen = function (...a) { return requestFullscreen.apply(this, a).then((v) => { raise(); return v; }); };
  document.addEventListener("toggle", (e) => { if (e.target !== host) e.newState === "open" ? raise() : placeControls(); }, true);
  document.addEventListener("fullscreenchange", raise);

  window.__showcaseSpike = {
    host,
    counts,
    opts,
    raise,
    ctlHost,
    async pointTo(x, y, ms = 600) {
      const a = pointer.animate(
        [{ transform: `translate(${px}px, ${py}px)` }, { transform: `translate(${x}px, ${y}px)` }],
        { duration: ms, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" },
      );
      px = x;
      py = y;
      await a.finished;
      a.commitStyles();
      a.cancel();
    },
    spotlight(r) {
      if (!r) { spot.style.display = "none"; return; }
      Object.assign(spot.style, { display: "block", left: `${r.x - 6}px`, top: `${r.y - 6}px`, width: `${r.width + 12}px`, height: `${r.height + 12}px` });
    },
    placeBar(x, y) {
      Object.assign(bar.style, { left: `${x}px`, top: `${y}px`, bottom: "auto", transform: "translate(-50%, -50%)" });
    },
    barRect() { return bar.getBoundingClientRect().toJSON(); },
    buttonRect(c) { return croot.querySelector(`[data-c="${c}"]`).getBoundingClientRect().toJSON(); },
  };
})();
