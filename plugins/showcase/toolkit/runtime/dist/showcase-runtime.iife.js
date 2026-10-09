"use strict";
(() => {
  // toolkit/runtime/src/anchors.ts
  var AnchorError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "AnchorError";
    }
  };
  function deref(ref, named = {}) {
    if (typeof ref !== "string") return ref;
    if (!ref.startsWith("@")) throw new AnchorError(`'${ref}' is not an anchor: use '@name' or an object`);
    const a = named[ref.slice(1)];
    if (!a) throw new AnchorError(`'${ref}' isn't in the tour's anchors`);
    return a;
  }
  var squash = (s) => (s ?? "").replace(/\s+/g, " ").trim();
  function matcher(want, exact) {
    if (typeof want !== "string") {
      const re = new RegExp(want.pattern, want.flags ?? "");
      return (s) => re.test(s);
    }
    const w = squash(want);
    if (exact) return (s) => s === w;
    const lower = w.toLowerCase();
    return (s) => s.toLowerCase().includes(lower);
  }
  var INPUT_ROLES = {
    button: "button",
    submit: "button",
    reset: "button",
    image: "button",
    checkbox: "checkbox",
    radio: "radio",
    range: "slider",
    number: "spinbutton",
    search: "searchbox",
    email: "textbox",
    tel: "textbox",
    text: "textbox",
    url: "textbox",
    password: "textbox"
  };
  function roleOf(el) {
    const explicit = squash(el.getAttribute("role")).split(" ")[0];
    if (explicit) return explicit;
    const tag = el.tagName.toLowerCase();
    switch (tag) {
      case "a":
      case "area":
        return el.hasAttribute("href") ? "link" : null;
      case "button":
        return "button";
      case "input": {
        const input = el;
        const type = (input.getAttribute("type") ?? "text").toLowerCase();
        if (type === "hidden") return null;
        if (input.hasAttribute("list") && (type === "text" || type === "search" || type === "email" || type === "tel" || type === "url"))
          return "combobox";
        return INPUT_ROLES[type] ?? "textbox";
      }
      case "textarea":
        return "textbox";
      case "select": {
        const s = el;
        return s.multiple || s.size > 1 ? "listbox" : "combobox";
      }
      case "option":
        return "option";
      case "optgroup":
        return "group";
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        return "heading";
      case "img":
        return el.getAttribute("alt") === "" ? "presentation" : "img";
      case "nav":
        return "navigation";
      case "main":
        return "main";
      case "header":
        return el.closest("article, aside, main, nav, section") ? null : "banner";
      case "footer":
        return el.closest("article, aside, main, nav, section") ? null : "contentinfo";
      case "aside":
        return "complementary";
      case "article":
        return "article";
      case "section":
        return el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby") ? "region" : null;
      case "form":
        return el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby") ? "form" : null;
      case "dialog":
        return "dialog";
      case "ul":
      case "ol":
      case "menu":
        return "list";
      case "li":
        return "listitem";
      case "table":
        return "table";
      case "thead":
      case "tbody":
      case "tfoot":
        return "rowgroup";
      case "tr":
        return "row";
      case "th":
        return "columnheader";
      case "td":
        return "cell";
      case "progress":
        return "progressbar";
      case "meter":
        return "meter";
      case "fieldset":
        return "group";
      case "details":
        return "group";
      case "summary":
        return "button";
      case "hr":
        return "separator";
      case "output":
        return "status";
      case "dl":
        return "list";
      case "figure":
        return "figure";
      default:
        return null;
    }
  }
  var NAMED_FROM_CONTENT = /* @__PURE__ */ new Set([
    "button",
    "cell",
    "checkbox",
    "columnheader",
    "gridcell",
    "heading",
    "link",
    "menuitem",
    "menuitemcheckbox",
    "menuitemradio",
    "option",
    "radio",
    "row",
    "rowheader",
    "switch",
    "tab",
    "tooltip",
    "treeitem",
    "listitem"
  ]);
  var ROLE_SELECTORS = {
    button: 'button, summary, input[type="button"], input[type="submit"], input[type="reset"], input[type="image"], [role="button"]',
    link: 'a[href], area[href], [role="link"]',
    textbox: 'input, textarea, [role="textbox"]',
    searchbox: 'input[type="search"], [role="searchbox"]',
    checkbox: 'input[type="checkbox"], [role="checkbox"]',
    radio: 'input[type="radio"], [role="radio"]',
    combobox: 'select, input[list], [role="combobox"]',
    listbox: 'select, [role="listbox"]',
    option: 'option, [role="option"]',
    heading: 'h1, h2, h3, h4, h5, h6, [role="heading"]',
    img: 'img, [role="img"]',
    navigation: 'nav, [role="navigation"]',
    main: 'main, [role="main"]',
    banner: 'header, [role="banner"]',
    contentinfo: 'footer, [role="contentinfo"]',
    region: 'section, [role="region"]',
    form: 'form, [role="form"]',
    dialog: 'dialog, [role="dialog"]',
    list: 'ul, ol, menu, dl, [role="list"]',
    listitem: 'li, [role="listitem"]',
    table: 'table, [role="table"]',
    row: 'tr, [role="row"]',
    cell: 'td, [role="cell"]',
    columnheader: 'th, [role="columnheader"]',
    progressbar: 'progress, [role="progressbar"]',
    group: 'fieldset, details, optgroup, [role="group"]',
    status: 'output, [role="status"]',
    figure: 'figure, [role="figure"]',
    separator: 'hr, [role="separator"]',
    slider: 'input[type="range"], [role="slider"]',
    spinbutton: 'input[type="number"], [role="spinbutton"]'
  };
  function textWithAlts(el) {
    const parts = [];
    const walk = (node) => {
      if (node.nodeType === 3) {
        parts.push(node.nodeValue ?? "");
        return;
      }
      if (node.nodeType !== 1) return;
      const e = node;
      if (e.getAttribute("aria-hidden") === "true") return;
      const label = e.getAttribute("aria-label");
      if (label !== null && e !== el) {
        parts.push(label);
        return;
      }
      if (e.tagName === "IMG") {
        parts.push(e.getAttribute("alt") ?? "");
        return;
      }
      const root = e.shadowRoot;
      for (const child of root ? [...root.childNodes] : [...e.childNodes]) walk(child);
    };
    walk(el);
    return squash(parts.join(" "));
  }
  function labelsOf(el) {
    const out = [];
    const own = el.labels;
    if (own && own.length) for (const l of own) out.push(textWithAlts(l));
    const labelledby = el.getAttribute("aria-labelledby");
    if (labelledby) {
      const root = el.getRootNode();
      for (const id of labelledby.split(/\s+/).filter(Boolean)) {
        const ref = root.getElementById?.(id) ?? el.ownerDocument.getElementById(id);
        if (ref) out.push(ref === el ? el.getAttribute("aria-label") ?? textWithAlts(el) : textWithAlts(ref));
      }
    }
    return out.filter(Boolean);
  }
  function accessibleName(el, role = roleOf(el)) {
    const labelledby = el.getAttribute("aria-labelledby");
    if (labelledby) {
      const name = labelsOf(el).join(" ");
      if (name) return squash(name);
    }
    const aria = el.getAttribute("aria-label");
    if (aria && squash(aria)) return squash(aria);
    const tag = el.tagName.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select" || tag === "meter" || tag === "progress" || tag === "output") {
      const labels = el.labels;
      if (labels && labels.length) return squash([...labels].map(textWithAlts).join(" "));
    }
    if (tag === "input") {
      const type = (el.getAttribute("type") ?? "text").toLowerCase();
      if (type === "image") return squash(el.getAttribute("alt") ?? el.getAttribute("value") ?? "");
      if (type === "button" || type === "submit" || type === "reset") return squash(el.value || el.getAttribute("value") || "");
    }
    if (tag === "img" || tag === "area") return squash(el.getAttribute("alt"));
    if (tag === "fieldset") {
      const legend = el.querySelector(":scope > legend");
      if (legend) return textWithAlts(legend);
    }
    if (tag === "table") {
      const caption = el.querySelector(":scope > caption");
      if (caption) return textWithAlts(caption);
    }
    if (tag === "figure") {
      const cap = el.querySelector(":scope > figcaption");
      if (cap) return textWithAlts(cap);
    }
    if (tag === "details") {
      const summary = el.querySelector(":scope > summary");
      if (summary) return textWithAlts(summary);
    }
    if (role && NAMED_FROM_CONTENT.has(role)) {
      const content = textWithAlts(el);
      if (content) return content;
    }
    const title = el.getAttribute("title");
    if (title && squash(title)) return squash(title);
    const placeholder = el.getAttribute("placeholder");
    if (placeholder && squash(placeholder)) return squash(placeholder);
    return "";
  }
  function isVisible(el) {
    if (!el.isConnected) return false;
    const view = el.ownerDocument.defaultView;
    if (!view) return false;
    if (el.tagName === "OPTION") {
      const select = el.closest("select");
      return select ? isVisible(select) : false;
    }
    const rects = el.getClientRects();
    if (rects.length === 0) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const style = view.getComputedStyle(el);
    if (style.visibility === "hidden" || style.visibility === "collapse") return false;
    return true;
  }
  function rectOf(el) {
    const r = el.getBoundingClientRect();
    let x = r.left;
    let y = r.top;
    let view = el.ownerDocument.defaultView;
    while (view && view !== view.parent) {
      let frame = null;
      try {
        frame = view.frameElement;
      } catch {
        frame = null;
      }
      if (!frame) break;
      const fr = frame.getBoundingClientRect();
      x += fr.left + frame.clientLeft;
      y += fr.top + frame.clientTop;
      view = frame.ownerDocument.defaultView;
    }
    return { x, y, w: r.width, h: r.height };
  }
  function centreOf(rect) {
    return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
  }
  function documentsOf(top) {
    const docs = [top];
    const walk = (doc) => {
      for (const frame of doc.querySelectorAll("iframe, frame")) {
        try {
          const inner = frame.contentDocument;
          if (inner && !docs.includes(inner)) {
            docs.push(inner);
            walk(inner);
          }
        } catch {
        }
      }
    };
    walk(top);
    return docs;
  }
  function queryDeep(root, selector) {
    const out = [];
    const visit = (node) => {
      let found;
      try {
        found = [...node.querySelectorAll(selector)];
      } catch {
        throw new AnchorError(`invalid CSS selector: ${selector}`);
      }
      const hosts = [...node.querySelectorAll("*")].filter((e) => e.shadowRoot);
      if (hosts.length === 0) {
        out.push(...found);
        return;
      }
      const shadowed = new Set(hosts);
      const all = [...node.querySelectorAll("*")];
      const matched = new Set(found);
      for (const e of all) {
        if (matched.has(e)) out.push(e);
        if (shadowed.has(e) && e.shadowRoot) visit(e.shadowRoot);
      }
    };
    if (root.shadowRoot && root !== root.ownerDocument) {
      visit(root);
      visit(root.shadowRoot);
      return out;
    }
    visit(root);
    return out;
  }
  function frameDocument(selector, top) {
    const frame = queryDeep(top, selector)[0];
    if (!frame || frame.tagName !== "IFRAME" && frame.tagName !== "FRAME") return null;
    try {
      return frame.contentDocument;
    } catch {
      return null;
    }
  }
  function candidatesIn(scope, a) {
    if (a.css) return queryDeep(scope, a.css);
    if (a.testId !== void 0) return queryDeep(scope, `[data-testid="${CSS.escape(a.testId)}"], [data-test-id="${CSS.escape(a.testId)}"], [data-test="${CSS.escape(a.testId)}"]`);
    if (a.role) return queryDeep(scope, ROLE_SELECTORS[a.role] ?? `[role="${CSS.escape(a.role)}"]`);
    if (a.label !== void 0) return queryDeep(scope, "input, textarea, select, meter, progress, output, [aria-labelledby], [aria-label]");
    return queryDeep(scope, "*");
  }
  function matches(el, a) {
    const exact = a.exact === true;
    let role;
    if (a.role) {
      role = roleOf(el);
      if (role !== a.role) return false;
    }
    if (a.name !== void 0) {
      if (role === void 0) role = roleOf(el);
      if (!matcher(a.name, exact)(accessibleName(el, role))) return false;
    }
    if (a.label !== void 0) {
      const labels = labelsOf(el);
      const m = matcher(a.label, exact);
      if (!labels.some(m) && !m(accessibleName(el))) return false;
    }
    if (a.text !== void 0 && !matcher(a.text, exact)(textWithAlts(el))) return false;
    return true;
  }
  function resolveIn(doc, a, ctx) {
    let scope = doc;
    if (a.within !== void 0) {
      const parent = resolve(a.within, { ...ctx, document: doc }, { sameFrame: true });
      if (!parent) return [];
      scope = parent;
    }
    const found = candidatesIn(scope, a).filter((el) => matches(el, a));
    if (a.text !== void 0 && a.css === void 0 && a.role === void 0 && a.label === void 0 && a.testId === void 0) {
      return found.filter((el) => !found.some((other) => other !== el && el.contains(other)));
    }
    return found;
  }
  function resolveAll(ref, ctx, options = {}) {
    const a = deref(ref, ctx.anchors);
    const top = ctx.document;
    let docs;
    if (a.frame) {
      const d = frameDocument(a.frame, top);
      docs = d ? [d] : [];
    } else {
      docs = options.sameFrame ? [top] : documentsOf(top);
    }
    const all = [];
    for (const doc of docs) {
      const found = resolveIn(doc, a, ctx);
      if (found.length) {
        all.push(...found);
        if (!a.frame) break;
      }
    }
    const visible = all.filter(isVisible);
    const hidden = all.filter((el) => !visible.includes(el));
    return [...visible, ...hidden];
  }
  function resolve(ref, ctx, options = {}) {
    const all = resolveAll(ref, ctx, options);
    const a = deref(ref, ctx.anchors);
    const n = a.nth ?? 0;
    return all[n < 0 ? all.length + n : n] ?? null;
  }
  function showText(t) {
    return typeof t === "string" ? `"${t}"` : `/${t.pattern}/${t.flags ?? ""}`;
  }
  function describeAnchor(ref, named = {}) {
    if (typeof ref === "string") {
      const a2 = named[ref.slice(1)];
      return a2 ? `${ref} (${describeAnchor(a2, named)})` : ref;
    }
    const a = ref;
    const parts = [];
    if (a.role) parts.push(a.name !== void 0 ? `${a.role} ${showText(a.name)}` : `role ${a.role}`);
    else if (a.name !== void 0) parts.push(`name ${showText(a.name)}`);
    if (a.label !== void 0) parts.push(`label ${showText(a.label)}`);
    if (a.testId !== void 0) parts.push(`test id "${a.testId}"`);
    if (a.text !== void 0) parts.push(`text ${showText(a.text)}`);
    if (a.css) parts.push(a.css);
    if (a.nth !== void 0) parts.push(`#${a.nth}`);
    if (a.within !== void 0) parts.push(`in ${describeAnchor(a.within, named)}`);
    if (a.frame) parts.push(`(frame ${a.frame})`);
    return parts.join(" ") || "an anchor";
  }

  // toolkit/runtime/src/audio.ts
  var AUDIO_GRACE_MS = 300;
  var MUTED_KEY = "showcase:muted";
  function createBridgeAudio(options) {
    const { bridge, document: doc, storage } = options;
    const win = doc.defaultView;
    const stats = { played: [], failed: [] };
    const urls = /* @__PURE__ */ new Map();
    let muted = options.muted ?? false;
    try {
      const kept = storage?.getItem(MUTED_KEY);
      if (kept === "true") muted = true;
      else if (kept === "false" && options.muted === void 0) muted = false;
    } catch {
    }
    let el = null;
    let held = false;
    const element = () => {
      if (el) return el;
      if (!win) return null;
      el = new win.Audio();
      el.preload = "auto";
      el.muted = muted;
      return el;
    };
    const load = (file) => {
      let p = urls.get(file);
      if (!p) {
        p = bridge.asset(file, "voice").then((data) => {
          const View = win ?? globalThis;
          const blob = new View.Blob([data.bytes], { type: data.type || "audio/mpeg" });
          return View.URL.createObjectURL(blob);
        }).catch((e) => {
          stats.failed.push(`${file}: ${e instanceof Error ? e.message : String(e)}`);
          return null;
        });
        urls.set(file, p);
      }
      return p;
    };
    if (bridge.present && options.manifest) {
      const files = [...new Set(options.manifest.clips.map((c) => c.file))];
      void (async () => {
        for (const f of files) await load(f);
      })();
    }
    return {
      stats,
      get element() {
        return el;
      },
      get muted() {
        return muted;
      },
      setMuted(m) {
        muted = m;
        if (el) el.muted = m;
        try {
          storage?.setItem(MUTED_KEY, String(m));
        } catch {
        }
      },
      preload(cue) {
        if (cue.audio && bridge.present) void load(cue.audio.file);
      },
      async play(cue, signal) {
        if (!cue.audio || !bridge.present) return;
        const a = element();
        if (!a) return;
        held = false;
        await new Promise((resolve2) => {
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            options.clearTimeout(timer);
            a.removeEventListener("playing", finish);
            signal?.removeEventListener("abort", finish);
            resolve2();
          };
          const timer = options.setTimeout(finish, AUDIO_GRACE_MS);
          signal?.addEventListener("abort", finish, { once: true });
          a.addEventListener("playing", finish);
          void load(cue.audio.file).then((url) => {
            if (!url || signal?.aborted) {
              finish();
              return;
            }
            a.src = url;
            a.muted = muted;
            a.currentTime = 0;
            stats.played.push(cue.audio.hash);
            const p = a.play();
            if (p) p.catch((e) => stats.failed.push(`play: ${e instanceof Error ? e.message : String(e)}`));
          });
        });
      },
      pause() {
        if (el && !el.paused) {
          el.pause();
          held = true;
        }
      },
      resume() {
        if (el && held) {
          held = false;
          void el.play()?.catch(() => {
          });
        }
      },
      stop() {
        held = false;
        if (el) {
          el.pause();
          try {
            el.currentTime = 0;
          } catch {
          }
        }
      }
    };
  }

  // toolkit/runtime/src/film-events.ts
  var FILM_VERSION = 1;
  var HOST_BINDING = "__showcaseHost";
  var GO_KEY = "__showcaseGo";
  var API_KEY = "__showcase";
  var FILM_EVENT_NAME = "showcase:film";
  var FILM_LOG_KEY = "__showcaseFilmLog";

  // toolkit/runtime/src/bridge.ts
  function decode(base64) {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  function createBridge(win = window) {
    const host = win[HOST_BINDING];
    const fn = typeof host === "function" ? host : null;
    const send = (msg) => {
      if (!fn) return Promise.reject(new Error("no host is bound"));
      return fn(msg);
    };
    const fire = (msg) => {
      if (!fn) return;
      try {
        void fn(msg).catch(() => {
        });
      } catch {
      }
    };
    return {
      present: fn !== null,
      async input(input) {
        await send({ type: "input", input });
      },
      loadState: () => send({ type: "state", op: "load" }),
      saveState: (state) => fire({ type: "state", op: "save", state }),
      clearState: () => fire({ type: "state", op: "clear" }),
      async asset(path, kind) {
        const a = await send({ type: "asset", path, ...kind ? { kind } : {} });
        return { name: a.name, type: a.type, bytes: decode(a.base64) };
      },
      event: (event) => fire({ type: "event", event }),
      log: (level, message) => fire({ type: "log", level, message }),
      ready: (info) => fire({ type: "ready", ...info }),
      snapshot: (snapshot) => fire({ type: "snapshot", snapshot }),
      async checkpoint(checkpoint) {
        await send({ type: "checkpoint", checkpoint });
      },
      exit: () => fire({ type: "exit" })
    };
  }
  function waitForGo(win = window) {
    let go = () => {
    };
    const armed = new Promise((resolve2) => {
      go = resolve2;
    });
    const w = win;
    w[GO_KEY] = () => {
      go();
      return true;
    };
    return {
      armed,
      disarm: () => {
        if (w[GO_KEY]) w[GO_KEY] = () => false;
      }
    };
  }

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
  function natives(win = window) {
    return captureNatives(win);
  }
  function isTopFrame(win = window) {
    try {
      return win.top === win;
    } catch {
      return false;
    }
  }
  function nextFrame(n = natives()) {
    return new Promise((resolve2) => n.requestAnimationFrame(() => resolve2()));
  }

  // toolkit/runtime/src/clock.ts
  var Aborted = class extends Error {
    constructor() {
      super("Aborted");
      this.name = "Aborted";
    }
  };
  function isAborted(e) {
    if (e instanceof Aborted) return true;
    return typeof e === "object" && e !== null && e.name === "AbortError";
  }
  function whenAborted(signal) {
    return new Promise((_, reject) => {
      if (signal.aborted) reject(new Aborted());
      else signal.addEventListener("abort", () => reject(new Aborted()), { once: true });
    });
  }
  function throwIfAborted(signal) {
    if (signal?.aborted) throw new Aborted();
  }
  var BaseClock = class {
    speed;
    timers = /* @__PURE__ */ new Set();
    isPaused = false;
    constructor(speed = 1) {
      if (!(speed > 0)) throw new Error(`A clock's speed is positive: ${speed}`);
      this.speed = speed;
    }
    get paused() {
      return this.isPaused;
    }
    sleep(ms, signal) {
      return new Promise((resolve2, reject) => {
        if (signal?.aborted) {
          reject(new Aborted());
          return;
        }
        const timer = { left: Math.max(0, ms) / this.speed, resolve: resolve2, reject };
        if (signal) {
          timer.signal = signal;
          timer.onAbort = () => {
            this.disarm(timer);
            this.timers.delete(timer);
            reject(new Aborted());
          };
          signal.addEventListener("abort", timer.onAbort, { once: true });
        }
        this.timers.add(timer);
        if (!this.isPaused) this.arm(timer);
      });
    }
    fire(timer) {
      this.timers.delete(timer);
      if (timer.onAbort) timer.signal?.removeEventListener("abort", timer.onAbort);
      timer.resolve();
    }
    pause() {
      if (this.isPaused) return;
      this.isPaused = true;
      for (const t of this.timers) this.disarm(t);
    }
    resume() {
      if (!this.isPaused) return;
      this.isPaused = false;
      for (const t of this.timers) this.arm(t);
    }
  };
  function nodeTimers() {
    const g = globalThis;
    return {
      now: () => g.performance ? g.performance.now() : Date.now(),
      setTimeout: (fn, ms) => g.setTimeout(fn, ms),
      clearTimeout: (id) => g.clearTimeout(id)
    };
  }
  var RealClock = class extends BaseClock {
    timers_;
    ran = 0;
    since;
    constructor(speed = 1, timers = nodeTimers()) {
      super(speed);
      this.timers_ = timers;
      this.since = timers.now();
    }
    now() {
      return this.ran + (this.since === null ? 0 : this.timers_.now() - this.since);
    }
    arm(timer) {
      timer.armedAt = this.timers_.now();
      timer.handle = this.timers_.setTimeout(() => this.fire(timer), timer.left);
    }
    disarm(timer) {
      if (timer.handle === void 0) return;
      this.timers_.clearTimeout(timer.handle);
      timer.handle = void 0;
      timer.left = Math.max(0, timer.left - (this.timers_.now() - (timer.armedAt ?? 0)));
    }
    pause() {
      if (this.isPaused) return;
      this.ran = this.now();
      this.since = null;
      super.pause();
    }
    resume() {
      if (!this.isPaused) return;
      this.since = this.timers_.now();
      super.resume();
    }
  };
  function createClocks(speed, timers) {
    return { pace: new RealClock(speed, timers), wall: new RealClock(1, timers), ticker: new RealClock(1, timers) };
  }

  // toolkit/runtime/src/dom-events.ts
  function realmOf(el) {
    const view = el.ownerDocument.defaultView;
    if (!view) throw new Error("The element's document has no window");
    return view;
  }
  function make(Ctor, type, init, view) {
    try {
      return new Ctor(type, { ...init, view });
    } catch {
      return new Ctor(type, init);
    }
  }
  function centre(el) {
    const r = el.getBoundingClientRect();
    return { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
  }
  var NON_BUBBLING = /* @__PURE__ */ new Set(["pointerenter", "pointerleave", "mouseenter", "mouseleave"]);
  function fireMouse(el, type, init = {}) {
    const view = realmOf(el);
    return el.dispatchEvent(
      make(
        view.MouseEvent,
        type,
        {
          bubbles: !NON_BUBBLING.has(type),
          cancelable: !NON_BUBBLING.has(type),
          composed: true,
          button: 0,
          buttons: type === "mousedown" ? 1 : 0,
          detail: type === "mousedown" || type === "mouseup" ? 1 : 0,
          ...centre(el),
          ...init
        },
        view
      )
    );
  }
  function firePointer(el, type, init = {}) {
    const view = realmOf(el);
    const Ctor = typeof view.PointerEvent === "function" ? view.PointerEvent : view.MouseEvent;
    return el.dispatchEvent(
      make(
        Ctor,
        type,
        {
          bubbles: !NON_BUBBLING.has(type),
          cancelable: !NON_BUBBLING.has(type),
          composed: true,
          button: 0,
          buttons: type === "pointerdown" ? 1 : 0,
          pointerId: 1,
          pointerType: "mouse",
          isPrimary: true,
          ...centre(el),
          ...init
        },
        view
      )
    );
  }
  function fireKey(el, type, key, init = {}) {
    const view = realmOf(el);
    return el.dispatchEvent(make(view.KeyboardEvent, type, { key, code: codeOf(key), bubbles: true, cancelable: true, composed: true, ...init }, view));
  }
  function parseKey(spec) {
    const parts = spec.split("+");
    const key = parts.pop() ?? spec;
    const init = {};
    for (const m of parts) {
      const mod = m.toLowerCase();
      if (mod === "shift") init.shiftKey = true;
      else if (mod === "control" || mod === "ctrl") init.ctrlKey = true;
      else if (mod === "alt") init.altKey = true;
      else if (mod === "meta" || mod === "controlormeta") init.metaKey = true;
    }
    return { key: key === "Space" ? " " : key, init };
  }
  function codeOf(key) {
    if (key.length === 1) {
      if (/[a-z]/i.test(key)) return `Key${key.toUpperCase()}`;
      if (/\d/.test(key)) return `Digit${key}`;
      if (key === " ") return "Space";
    }
    return key;
  }
  function fireInput(el, data, inputType = "insertText") {
    const view = realmOf(el);
    const Ctor = typeof view.InputEvent === "function" ? view.InputEvent : view.Event;
    return el.dispatchEvent(new Ctor("input", { bubbles: true, cancelable: false, composed: true, data, inputType }));
  }
  function fireBeforeInput(el, data, inputType = "insertText") {
    const view = realmOf(el);
    if (typeof view.InputEvent !== "function") return true;
    return el.dispatchEvent(new view.InputEvent("beforeinput", { bubbles: true, cancelable: true, composed: true, data, inputType }));
  }
  function fireChange(el) {
    const view = realmOf(el);
    return el.dispatchEvent(new view.Event("change", { bubbles: true, cancelable: false }));
  }
  function isValueElement(el) {
    return /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
  }
  function isEditable(el) {
    return el.isContentEditable === true;
  }
  function setNativeValue(el, value, natives2) {
    const view = realmOf(el);
    const top = natives2 && el.ownerDocument.defaultView === window;
    let setter;
    if (el.tagName === "TEXTAREA") setter = top ? natives2.setters.textareaValue : Object.getOwnPropertyDescriptor(view.HTMLTextAreaElement.prototype, "value")?.set;
    else if (el.tagName === "SELECT") setter = top ? natives2.setters.selectValue : Object.getOwnPropertyDescriptor(view.HTMLSelectElement.prototype, "value")?.set;
    else setter = top ? natives2.setters.inputValue : Object.getOwnPropertyDescriptor(view.HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
  }
  function clickSequence(el, from = null, button = "left") {
    const related = { relatedTarget: from ?? el.ownerDocument.body };
    const b = button === "right" ? 2 : button === "middle" ? 1 : 0;
    firePointer(el, "pointerover", related);
    firePointer(el, "pointerenter", related);
    fireMouse(el, "mouseover", related);
    fireMouse(el, "mouseenter", related);
    firePointer(el, "pointerdown", { button: b, buttons: b === 0 ? 1 : b === 1 ? 4 : 2 });
    if (fireMouse(el, "mousedown", { button: b, buttons: b === 0 ? 1 : b === 1 ? 4 : 2 })) focusQuietly(el);
    firePointer(el, "pointerup", { button: b });
    fireMouse(el, "mouseup", { button: b });
    if (button === "right") fireMouse(el, "contextmenu", { button: 2 });
    else if (button === "middle") fireMouse(el, "auxclick", { button: 1 });
    else el.click();
  }
  function hoverOn(el, from = null) {
    const related = { relatedTarget: from ?? el.ownerDocument.body };
    firePointer(el, "pointerover", related);
    firePointer(el, "pointerenter", related);
    fireMouse(el, "mouseover", related);
    fireMouse(el, "mouseenter", related);
    firePointer(el, "pointermove");
    fireMouse(el, "mousemove");
  }
  function hoverOff(el, to = null) {
    const related = { relatedTarget: to ?? el.ownerDocument.body };
    firePointer(el, "pointerout", related);
    firePointer(el, "pointerleave", related);
    fireMouse(el, "mouseout", related);
    fireMouse(el, "mouseleave", related);
  }
  function focusQuietly(el) {
    el.focus?.({ preventScroll: true });
  }
  function blur(el) {
    el.blur?.();
  }
  function insertEditableText(el, text) {
    const view = realmOf(el);
    const doc = el.ownerDocument;
    if (doc.activeElement !== el) focusQuietly(el);
    if (!fireBeforeInput(el, text, "insertText")) return false;
    let inserted = false;
    try {
      inserted = doc.execCommand("insertText", false, text);
    } catch {
      inserted = false;
    }
    if (!inserted) {
      const sel = view.getSelection();
      const range = sel && sel.rangeCount > 0 && el.contains(sel.anchorNode) ? sel.getRangeAt(0) : null;
      if (range) {
        range.deleteContents();
        const node = doc.createTextNode(text);
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(range);
      } else {
        el.append(doc.createTextNode(text));
      }
      fireInput(el, text, "insertText");
    }
    return true;
  }
  function selectAll(el) {
    if (isValueElement(el) && el.tagName !== "SELECT") {
      el.select();
      return;
    }
    const view = realmOf(el);
    const range = el.ownerDocument.createRange();
    range.selectNodeContents(el);
    const sel = view.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
  function caretToEnd(el) {
    if (isValueElement(el) && el.tagName !== "SELECT") {
      const f = el;
      const n = f.value.length;
      try {
        f.setSelectionRange(n, n);
      } catch {
      }
      return;
    }
    const view = realmOf(el);
    const range = el.ownerDocument.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = view.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
  function clearEditable(el) {
    if (!fireBeforeInput(el, null, "deleteContentBackward")) return false;
    let done = false;
    try {
      selectAll(el);
      done = el.ownerDocument.execCommand("delete", false);
    } catch {
      done = false;
    }
    if (!done) {
      el.textContent = "";
      fireInput(el, null, "deleteContentBackward");
    }
    return true;
  }
  function setFiles(input, files) {
    const view = realmOf(input);
    const dt = new view.DataTransfer();
    for (const f of files) dt.items.add(new view.File([f.bytes], f.name, { type: f.type }));
    input.files = dt.files;
    fireInput(input, null, "insertFromPaste");
    fireChange(input);
  }
  function dragSequence(from, to, point) {
    const view = realmOf(from);
    const dt = new view.DataTransfer();
    const at = point ?? centre(to);
    const drag = (el, type, init = {}) => {
      const Ctor = typeof view.DragEvent === "function" ? view.DragEvent : view.MouseEvent;
      return el.dispatchEvent(
        make(Ctor, type, { bubbles: true, cancelable: type !== "dragend" && type !== "dragleave", composed: true, dataTransfer: dt, ...centre(el), ...init }, view)
      );
    };
    firePointer(from, "pointerdown");
    fireMouse(from, "mousedown");
    drag(from, "dragstart");
    drag(to, "dragenter", at);
    drag(to, "dragover", at);
    drag(to, "drop", at);
    drag(from, "dragend");
    firePointer(to, "pointerup", at);
    fireMouse(to, "mouseup", at);
  }

  // toolkit/runtime/src/overlay-port.ts
  var NO_OVERLAY = {
    pointerTo: async () => {
    },
    press: () => {
    },
    spotlight: () => {
    },
    card: () => {
    },
    caption: () => {
    },
    acting: () => {
    },
    owns: () => false,
    pointer: () => null,
    movePointer: () => {
    },
    destroy: () => {
    }
  };

  // toolkit/runtime/src/ready.ts
  var ANCHOR_TIMEOUT_MS = 1e4;
  var READY_TIMEOUT_MS = 3e4;
  var POLL_MS = 100;
  function contextOf(anchors) {
    return {
      ...anchors,
      location: () => {
        const view = anchors.document.defaultView;
        return view ? view.location : { pathname: "", search: "" };
      }
    };
  }
  function isDisabled(el) {
    if (el.disabled === true) return true;
    if (el.getAttribute("aria-disabled") === "true") return true;
    return el.closest("fieldset[disabled]") !== null;
  }
  function test(match, value) {
    return new RegExp(match.pattern, match.flags ?? "").test(value);
  }
  function evaluate(ready, ctx) {
    switch (ready.kind) {
      case "exists":
        return resolve(ready.anchor, ctx) !== null;
      case "visible": {
        const el = resolve(ready.anchor, ctx);
        return el !== null && isVisible(el);
      }
      case "absent":
        return resolveAll(ready.anchor, ctx).every((el) => !isVisible(el));
      case "enabled": {
        const el = resolve(ready.anchor, ctx);
        return el !== null && !isDisabled(el);
      }
      case "attr": {
        const el = resolve(ready.anchor, ctx);
        if (!el) return false;
        const raw = ready.prop ? el[ready.name] : el.getAttribute(ready.name);
        if (raw === null || raw === void 0) return false;
        const value = String(raw);
        if (ready.equals !== void 0 && value !== ready.equals) return false;
        if (ready.contains !== void 0 && !value.includes(ready.contains)) return false;
        if (ready.matches !== void 0 && !test(ready.matches, value)) return false;
        if (ready.nonEmpty !== void 0 && value.trim() !== "" !== ready.nonEmpty) return false;
        return true;
      }
      case "text": {
        const el = resolve(ready.anchor, ctx);
        if (!el) return false;
        const value = squash(el.textContent);
        if (ready.equals !== void 0 && value !== squash(ready.equals)) return false;
        if (ready.contains !== void 0 && !value.toLowerCase().includes(squash(ready.contains).toLowerCase())) return false;
        if (ready.matches !== void 0 && !test(ready.matches, value)) return false;
        return true;
      }
      case "count": {
        const n = resolveAll(ready.anchor, ctx).filter(isVisible).length;
        return n >= (ready.min ?? 0) && n <= (ready.max ?? Number.POSITIVE_INFINITY);
      }
      case "url": {
        const { pathname, search } = ctx.location();
        if (ready.path !== void 0 && pathname !== ready.path) return false;
        const params = new URLSearchParams(search);
        return Object.entries(ready.params ?? {}).every(([k, v]) => params.get(k) === v);
      }
      case "all":
        return ready.of.every((r) => evaluate(r, ctx));
      case "any":
        return ready.of.some((r) => evaluate(r, ctx));
    }
  }
  function describeReady(ready, ctx) {
    const named = ctx?.anchors ?? {};
    switch (ready.kind) {
      case "exists":
        return `${describeAnchor(ready.anchor, named)} exists`;
      case "visible":
        return `${describeAnchor(ready.anchor, named)} is visible`;
      case "absent":
        return `${describeAnchor(ready.anchor, named)} is gone`;
      case "enabled":
        return `${describeAnchor(ready.anchor, named)} is enabled`;
      case "attr":
        return `${describeAnchor(ready.anchor, named)} has ${ready.name}`;
      case "text":
        return `${describeAnchor(ready.anchor, named)} says ${ready.equals ?? ready.contains ?? ready.matches?.pattern ?? ""}`;
      case "count":
        return `${describeAnchor(ready.anchor, named)} × ${ready.min ?? 0}–${ready.max ?? "∞"}`;
      case "url":
        return `the URL is ${ready.path ?? ""}${ready.params ? `?${new URLSearchParams(ready.params)}` : ""}`;
      case "all":
        return ready.of.map((r) => describeReady(r, ctx)).join(" and ");
      case "any":
        return ready.of.map((r) => describeReady(r, ctx)).join(" or ");
    }
  }
  function anchorOf(ready) {
    switch (ready.kind) {
      case "url":
        return null;
      case "all":
      case "any":
        for (const r of ready.of) {
          const a = anchorOf(r);
          if (a) return a;
        }
        return null;
      default:
        return ready.anchor;
    }
  }
  var ReadyTimeout = class extends Error {
    what;
    detail;
    timeoutMs;
    /** The anchor the wait was about, described, when there was one. */
    anchor;
    constructor(what, detail, timeoutMs, anchor = null) {
      super(what === "anchor" ? `Couldn't find ${detail} within ${Math.round(timeoutMs / 1e3)} s` : `Still waiting after ${Math.round(timeoutMs / 1e3)} s: ${detail}`);
      this.name = "ReadyTimeout";
      this.what = what;
      this.detail = detail;
      this.timeoutMs = timeoutMs;
      this.anchor = anchor;
    }
  };
  function documentsOf2(top) {
    const docs = [top];
    for (const frame of top.querySelectorAll("iframe")) {
      try {
        if (frame.contentDocument) docs.push(frame.contentDocument);
      } catch {
      }
    }
    return docs;
  }
  async function waitFor(ready, options) {
    const { ctx } = options;
    const doc = ctx.document;
    const timeoutMs = options.timeoutMs ?? READY_TIMEOUT_MS;
    if (options.signal?.aborted) throw new Aborted();
    if (evaluate(ready, ctx)) return;
    const stop = new AbortController();
    const onAbort = () => stop.abort();
    options.signal?.addEventListener("abort", onAbort, { once: true });
    let changed = null;
    const View = doc.defaultView;
    const observer = View && typeof View.MutationObserver === "function" ? new View.MutationObserver(() => changed?.()) : null;
    if (observer) {
      for (const d of documentsOf2(doc)) observer.observe(d, { subtree: true, childList: true, attributes: true, characterData: true });
    }
    const started = options.clock.now();
    try {
      for (; ; ) {
        const left = timeoutMs - (options.clock.now() - started);
        if (left <= 0) {
          const anchor = anchorOf(ready);
          const described = anchor ? describeAnchor(anchor, ctx.anchors) : null;
          const looking = options.what === "anchor" && (ready.kind === "exists" || ready.kind === "visible");
          throw new ReadyTimeout(options.what ?? "ready", looking && described ? described : describeReady(ready, ctx), timeoutMs, described);
        }
        const tick = new AbortController();
        const onStop = () => tick.abort();
        stop.signal.addEventListener("abort", onStop, { once: true });
        await new Promise((resolve2) => {
          changed = () => {
            tick.abort();
            resolve2();
          };
          options.clock.sleep(Math.min(POLL_MS, left) * options.clock.speed, tick.signal).then(resolve2, resolve2);
        });
        changed = null;
        stop.signal.removeEventListener("abort", onStop);
        if (options.signal?.aborted) throw new Aborted();
        if (evaluate(ready, ctx)) return;
      }
    } finally {
      observer?.disconnect();
      options.signal?.removeEventListener("abort", onAbort);
      stop.abort();
    }
  }

  // toolkit/runtime/src/executor.ts
  var TYPE_MS = 40;
  var PRESS_MS = 600;
  var SCROLL_SETTLE_MS = 300;
  var CAMERA_EASE_MS = 600;
  var STABLE_LIMIT_MS = 1500;
  function isCosmetic(action) {
    switch (action.kind) {
      case "spotlight":
      case "hover":
      case "focus":
      case "camera":
      case "card":
      case "hold":
        return true;
      case "wait":
        return action.until === void 0;
      default:
        return false;
    }
  }
  var ActionError = class extends Error {
    action;
    anchor;
    constructor(action, message, anchor = null) {
      super(`${action.label ?? action.id}: ${message}`);
      this.name = "ActionError";
      this.action = action;
      this.anchor = anchor;
    }
  };
  var INSETS = [
    [0.5, 0.5],
    [0.25, 0.5],
    [0.75, 0.5],
    [0.5, 0.25],
    [0.5, 0.75]
  ];
  function createExecutor(deps) {
    const overlay = deps.overlay ?? NO_OVERLAY;
    const natives2 = deps.natives ?? null;
    const ctx = deps.ctx;
    const doc = () => ctx.document;
    const view = () => doc().defaultView;
    const readyCtx = () => contextOf(ctx);
    const named = ctx.anchors;
    const frame = deps.frame ?? (() => Promise.resolve());
    let hovered = null;
    let ceiling = Number.POSITIVE_INFINITY;
    const readyMs = (action) => Math.min(action.timeoutMs ?? READY_TIMEOUT_MS, ceiling);
    const anchorMs = () => Math.min(ANCHOR_TIMEOUT_MS, ceiling);
    const trustedByDefault = (deps.input ?? (deps.bridge?.present ? "trusted" : "synthetic")) === "trusted" && !!deps.bridge?.present;
    const wantsTrusted = (action) => {
      const mode = action.input ?? (trustedByDefault ? "trusted" : "synthetic");
      return mode === "trusted" && !!deps.bridge?.present;
    };
    async function locate(action, ref, options = {}) {
      const named2 = describeAnchor(ref, ctx.anchors);
      try {
        await waitFor({ kind: "visible", anchor: ref }, { clock: deps.wall, ctx: readyCtx(), timeoutMs: anchorMs(), what: "anchor", ...options.signal ? { signal: options.signal } : {} });
        if (options.use) {
          await waitFor({ kind: "enabled", anchor: ref }, { clock: deps.wall, ctx: readyCtx(), timeoutMs: readyMs(action), ...options.signal ? { signal: options.signal } : {} });
        }
      } catch (e) {
        if (e instanceof ReadyTimeout) throw new ActionError(action, e.message, named2);
        throw e;
      }
      const el = resolve(ref, ctx);
      if (!el) throw new ActionError(action, `couldn't find ${named2}`, named2);
      return el;
    }
    function inView(el) {
      const v = view();
      if (!v) return true;
      const r = rectOf(el);
      if (!(r.y >= 0 && r.x >= 0 && r.y + r.h <= v.innerHeight && r.x + r.w <= v.innerWidth)) return false;
      const own = el.ownerDocument.defaultView;
      if (!own) return true;
      const b = el.getBoundingClientRect();
      if (el.ownerDocument !== doc() && !(b.top >= 0 && b.left >= 0 && b.bottom <= own.innerHeight && b.right <= own.innerWidth)) return false;
      for (let p = el.parentElement; p && p !== el.ownerDocument.documentElement; p = p.parentElement) {
        const style = own.getComputedStyle(p);
        const clips = (o) => o === "auto" || o === "scroll" || o === "hidden" || o === "clip";
        if (!clips(style.overflowY) && !clips(style.overflowX)) continue;
        const c = p.getBoundingClientRect();
        if (clips(style.overflowY) && (b.top < c.top || b.bottom > c.bottom)) return false;
        if (clips(style.overflowX) && (b.left < c.left || b.right > c.right)) return false;
      }
      return true;
    }
    function scrollToCentre(el) {
      el.scrollIntoView?.({ block: "center", inline: "center" });
    }
    async function stable(el, signal) {
      const started = deps.wall.now();
      let last = rectOf(el);
      for (; ; ) {
        await frame();
        throwIfAborted(signal);
        const now = rectOf(el);
        if (now.x === last.x && now.y === last.y && now.w === last.w && now.h === last.h) return now;
        last = now;
        if (deps.wall.now() - started > STABLE_LIMIT_MS) return now;
      }
    }
    function topAt(x, y) {
      let d = doc();
      let px = x;
      let py = y;
      for (let hops = 0; hops < 8; hops++) {
        const list = d.elementsFromPoint(px, py).filter((e) => !overlay.owns(e));
        const top = list[0] ?? null;
        if (!top) return null;
        if (top.tagName === "IFRAME") {
          let inner = null;
          try {
            inner = top.contentDocument;
          } catch {
            inner = null;
          }
          if (!inner) return top;
          const fr = top.getBoundingClientRect();
          px -= fr.left + top.clientLeft;
          py -= fr.top + top.clientTop;
          d = inner;
          continue;
        }
        return top;
      }
      return null;
    }
    function hits(el, top) {
      if (!top) return false;
      if (top === el || el.contains(top)) return true;
      let root = el.getRootNode();
      while (root instanceof ShadowRoot) {
        if (root.host === top || top.contains(root.host)) return true;
        root = root.host.getRootNode();
      }
      if (el.tagName === "LABEL" && el.control === top) return true;
      const labels = el.labels;
      if (labels) {
        for (const l of labels) if (l === top || l.contains(top)) return true;
      }
      return false;
    }
    async function clickable(el, signal) {
      if (!inView(el)) {
        scrollToCentre(el);
        await frame();
      }
      const rect = await stable(el, signal);
      if (rect.w === 0 && rect.h === 0) return { ok: false, point: centreOf(rect), rect, why: "it has no size" };
      for (const [fx, fy] of INSETS) {
        const point = { x: rect.x + rect.w * fx, y: rect.y + rect.h * fy };
        if (hits(el, topAt(point.x, point.y))) return { ok: true, point, rect };
      }
      const c = centreOf(rect);
      const cover = topAt(c.x, c.y);
      const name = cover ? `${cover.tagName.toLowerCase()}${cover.id ? `#${cover.id}` : ""}${cover.className && typeof cover.className === "string" ? `.${cover.className.split(" ")[0]}` : ""}` : "nothing";
      return { ok: false, point: c, rect, why: `${name} covers it` };
    }
    async function approach(el, instant, signal) {
      if (!inView(el)) {
        scrollToCentre(el);
        await frame();
      }
      if (instant) return rectOf(el);
      overlay.spotlight(null);
      if (hovered && hovered !== el) {
        hoverOff(hovered, el);
        hovered = null;
      }
      await overlay.pointerTo(rectOf(el), signal);
      throwIfAborted(signal);
      return rectOf(el);
    }
    const bridge = () => {
      const b = deps.bridge;
      if (!b?.present) throw new Error("no host for trusted input");
      return b;
    };
    async function host(req, point) {
      const n = natives2;
      const deadline = (n ? n.perfNow() : Date.now()) + 5e3;
      deps.acting?.({ kind: req.kind, point, deadline });
      overlay.acting(true);
      try {
        await bridge().input(req);
      } finally {
        overlay.acting(false);
        deps.acting?.(null);
      }
    }
    async function arrive(el, instant, signal) {
      const rect = await approach(el, instant, signal);
      const check2 = await clickable(el, signal);
      if (!instant && (check2.rect.x !== rect.x || check2.rect.y !== rect.y)) await overlay.pointerTo(check2.rect, signal);
      return check2;
    }
    async function trusted(action, el, instant, signal, req, synthetic) {
      if (!wantsTrusted(action)) {
        await approach(el, instant, signal);
        await synthetic();
        return "synthetic";
      }
      const check2 = await arrive(el, instant, signal);
      if (!check2.ok) {
        deps.onNote?.(`${action.id}: synthetic fallback, ${check2.why ?? "the target can't be reached"}`);
        await synthetic();
        return "synthetic";
      }
      if (!instant) overlay.press(check2.rect);
      await host(req(check2.point), check2.point);
      return "trusted";
    }
    async function click(action, instant, signal) {
      const el = await locate(action, action.target, { use: true, ...signal ? { signal } : {} });
      return trusted(action, el, instant, signal, (p) => ({ kind: "click", x: p.x, y: p.y, ...action.button ? { button: action.button } : {}, ...action.count ? { count: action.count } : {} }), () => clickSequence(el, hovered, action.button ?? "left"));
    }
    async function pressElement(action, el, instant, signal) {
      return trusted(action, el, instant, signal, (p) => ({ kind: "click", x: p.x, y: p.y }), () => clickSequence(el, hovered));
    }
    async function typeInto(action, instant, signal) {
      const el = await locate(action, action.target, { use: true, ...signal ? { signal } : {} });
      const control = el.tagName === "LABEL" ? el.control ?? el : el;
      const field = isValueElement(control) && control.tagName !== "SELECT" ? control : null;
      const editable = !field && isEditable(control) ? control : null;
      if (!field && !editable) throw new ActionError(action, "the target is not a text field", describeAnchor(action.target, ctx.anchors));
      const target = field ?? editable;
      let mode = "synthetic";
      const useTrusted = wantsTrusted(action);
      if (useTrusted) {
        const check2 = await arrive(target, instant, signal);
        if (check2.ok) {
          if (!instant) overlay.press(check2.rect);
          await host({ kind: "click", x: check2.point.x, y: check2.point.y }, check2.point);
          mode = "trusted";
        } else deps.onNote?.(`${action.id}: synthetic fallback, ${check2.why ?? "the field can't be reached"}`);
      } else await approach(target, instant, signal);
      if (mode === "synthetic") focusQuietly(target);
      try {
        if (action.append) caretToEnd(target);
        else if (field ? field.value !== "" : (editable?.textContent ?? "") !== "") {
          if (mode === "trusted") {
            selectAll(target);
            await host({ kind: "key", key: "Backspace" }, null);
          } else if (field) {
            setNativeValue(field, "", natives2);
            fireInput(field, null, "deleteContentBackward");
          } else if (editable) clearEditable(editable);
        }
        if (mode === "trusted") {
          if (instant) {
            if (action.text) await host({ kind: "type", text: action.text }, null);
          } else {
            for (const ch of action.text) {
              throwIfAborted(signal);
              await host({ kind: "type", text: ch }, null);
              await deps.pace.sleep(TYPE_MS, signal);
            }
          }
        } else if (field) {
          let value = field.value;
          if (instant) {
            if (action.text) {
              setNativeValue(field, value + action.text, natives2);
              fireInput(field, action.text);
            }
          } else {
            for (const ch of action.text) {
              value += ch;
              fireKey(field, "keydown", ch);
              setNativeValue(field, value, natives2);
              fireInput(field, ch);
              fireKey(field, "keyup", ch);
              await deps.pace.sleep(TYPE_MS, signal);
            }
          }
        } else if (editable) {
          if (instant) insertEditableText(editable, action.text);
          else {
            for (const ch of action.text) {
              insertEditableText(editable, ch);
              await deps.pace.sleep(TYPE_MS, signal);
            }
          }
        }
        if (action.submit === "enter") {
          if (mode === "trusted") await host({ kind: "key", key: "Enter" }, null);
          else {
            const unhandled = fireKey(target, "keydown", "Enter");
            fireKey(target, "keyup", "Enter");
            if (unhandled && field) field.form?.requestSubmit();
          }
        } else if (action.submit === "button") {
          const form = field?.form ?? editable?.closest("form") ?? null;
          const button = form?.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
          if (!button) throw new ActionError(action, "the field's form has no submit button");
          const started = deps.wall.now();
          while (button.disabled) {
            if (deps.wall.now() - started > readyMs(action)) throw new ActionError(action, "the submit button stayed disabled");
            await deps.wall.sleep(100, signal);
          }
          await pressElement(action, button, instant, signal);
        }
      } finally {
        if (action.submit !== "button") blur(target);
      }
      return mode;
    }
    async function select(action, instant, signal) {
      const el = await locate(action, action.target, { use: true, ...signal ? { signal } : {} });
      const control = el.tagName === "LABEL" ? el.control ?? el : el;
      if (control.tagName !== "SELECT") throw new ActionError(action, "the target is not a select", describeAnchor(action.target, ctx.anchors));
      const sel = control;
      const options = [...sel.options];
      const want = action.value !== void 0 ? options.find((o) => o.value === action.value) : action.option !== void 0 ? options.find((o) => o.label.trim().toLowerCase() === action.option?.trim().toLowerCase()) ?? options.find((o) => o.label.toLowerCase().includes(action.option?.toLowerCase() ?? "")) : void 0;
      if (!want) throw new ActionError(action, `the select has no option ${JSON.stringify(action.value ?? action.option ?? "")}`);
      let mode = "synthetic";
      if (wantsTrusted(action)) {
        const check2 = await arrive(sel, instant, signal);
        if (check2.ok) {
          if (!instant) overlay.press(check2.rect);
          await host({ kind: "move", x: check2.point.x, y: check2.point.y }, check2.point);
          mode = "trusted";
        }
      } else await approach(sel, instant, signal);
      focusQuietly(sel);
      if (sel.value !== want.value) {
        setNativeValue(sel, want.value, natives2);
        fireInput(sel, null, "insertReplacementText");
        fireChange(sel);
      }
      blur(sel);
      return mode;
    }
    function isChecked(control) {
      if ("checked" in control && control.tagName === "INPUT") return control.checked;
      const aria = control.getAttribute("aria-checked") ?? control.getAttribute("aria-pressed");
      if (aria === "true") return true;
      if (aria === "false") return false;
      return null;
    }
    async function check(action, instant, signal) {
      const el = await locate(action, action.target, { use: true, ...signal ? { signal } : {} });
      const control = el.tagName === "LABEL" ? el.control ?? el : el;
      const want = action.checked ?? true;
      const now = isChecked(control);
      if (now === null) throw new ActionError(action, "the target is not a checkbox, a radio or a switch", describeAnchor(action.target, ctx.anchors));
      if (now === want) return null;
      const clickTarget = isVisible(control) ? control : (el.tagName === "LABEL" ? el : control.labels?.[0]) ?? control;
      return pressElement(action, clickTarget, instant, signal);
    }
    async function hover(action, instant, signal) {
      const el = await locate(action, action.target, signal ? { signal } : {});
      const mode = await trusted(action, el, instant, signal, (p) => ({ kind: "move", x: p.x, y: p.y, steps: 6 }), () => hoverOn(el, hovered));
      hovered = el;
      return mode;
    }
    async function key(action, instant, signal) {
      let el;
      if (action.target) {
        el = await locate(action, action.target, signal ? { signal } : {});
        await approach(el, instant, signal);
        focusQuietly(el);
      } else el = doc().activeElement ?? doc().body;
      if (wantsTrusted(action)) {
        await host({ kind: "key", key: action.key }, null);
        return "trusted";
      }
      const { key: k, init } = parseKey(action.key);
      const unhandled = fireKey(el, "keydown", k, init);
      fireKey(el, "keyup", k, init);
      if (unhandled && k === "Enter" && isValueElement(el) && el.tagName !== "SELECT") el.form?.requestSubmit();
      return "synthetic";
    }
    async function press(action, instant, signal) {
      const el = await locate(action, action.target, { use: true, ...signal ? { signal } : {} });
      const ms = action.ms ?? PRESS_MS;
      if (wantsTrusted(action)) {
        const c = await arrive(el, instant, signal);
        if (c.ok) {
          if (!instant) overlay.press(c.rect);
          await host({ kind: "down", x: c.point.x, y: c.point.y }, c.point);
          try {
            if (!instant) await deps.pace.sleep(ms, signal);
          } finally {
            await host({ kind: "up", x: c.point.x, y: c.point.y }, c.point);
          }
          return "trusted";
        }
        deps.onNote?.(`${action.id}: synthetic fallback, ${c.why ?? "the target can't be reached"}`);
      } else await approach(el, instant, signal);
      firePointer(el, "pointerdown");
      fireMouse(el, "mousedown");
      try {
        if (!instant) await deps.pace.sleep(ms, signal);
      } finally {
        firePointer(el, "pointerup");
        fireMouse(el, "mouseup");
        el.click?.();
      }
      return "synthetic";
    }
    function offsetPoint(from, by) {
      return { x: from.x + (by?.x ?? 0), y: from.y + (by?.y ?? 0) };
    }
    async function drag(action, instant, signal) {
      const el = await locate(action, action.target, { use: true, ...signal ? { signal } : {} });
      let toEl = null;
      let dest;
      if (action.to !== void 0) {
        toEl = await locate(action, action.to, signal ? { signal } : {});
        if (!inView(toEl)) {
          scrollToCentre(toEl);
          await frame();
        }
        dest = centreOf(rectOf(toEl));
      } else dest = offsetPoint(centreOf(rectOf(el)), action.by);
      if (wantsTrusted(action)) {
        const c = await arrive(el, instant, signal);
        if (c.ok) {
          if (!instant) overlay.press(c.rect);
          await host({ kind: "down", x: c.point.x, y: c.point.y }, c.point);
          try {
            if (toEl) dest = centreOf(rectOf(toEl));
            await host({ kind: "move", x: c.point.x + 4, y: c.point.y + 4, steps: 2 }, c.point);
            if (!instant) {
              const travel = overlay.pointerTo({ x: dest.x, y: dest.y, w: 0, h: 0 }, signal);
              await host({ kind: "move", x: dest.x, y: dest.y, steps: 12 }, dest);
              await travel;
            } else await host({ kind: "move", x: dest.x, y: dest.y, steps: 4 }, dest);
          } finally {
            await host({ kind: "up", x: dest.x, y: dest.y }, dest);
          }
          return "trusted";
        }
        deps.onNote?.(`${action.id}: synthetic fallback, ${c.why ?? "the target can't be reached"}`);
      } else await approach(el, instant, signal);
      const target = toEl ?? topAt(dest.x, dest.y) ?? doc().body;
      if (!instant) await overlay.pointerTo({ x: dest.x, y: dest.y, w: 0, h: 0 }, signal);
      dragSequence(el, target, { clientX: dest.x, clientY: dest.y });
      return "synthetic";
    }
    async function readFile(path) {
      if (deps.readFile) return deps.readFile(path);
      if (deps.bridge?.present) return deps.bridge.asset(path);
      const res = await fetch(path);
      if (!res.ok) throw new Error(`couldn't fetch ${path}: ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      return { name: path.split("/").pop() ?? path, type: res.headers.get("content-type") ?? "application/octet-stream", bytes };
    }
    async function upload(action, instant, signal) {
      const el = await locate(action, action.target, { use: true, ...signal ? { signal } : {} });
      const control = el.tagName === "LABEL" ? el.control ?? el : el;
      if (control.tagName !== "INPUT" || control.type !== "file") throw new ActionError(action, "the target is not a file input", describeAnchor(action.target, ctx.anchors));
      const input = control;
      if (wantsTrusted(action)) {
        if (isVisible(el)) await approach(el, instant, signal);
        view().__showcaseUploadTarget = input;
        await host({ kind: "upload", x: 0, y: 0, files: action.files }, null);
        return "trusted";
      }
      if (isVisible(el)) await approach(el, instant, signal);
      const files = await Promise.all(action.files.map(readFile));
      setFiles(input, files);
      return "synthetic";
    }
    async function settle(signal) {
      await frame();
      await deps.pace.sleep(SCROLL_SETTLE_MS, signal);
    }
    async function scroll(action, instant, signal) {
      const scroller = action.target ? await locate(action, action.target, signal ? { signal } : {}) : null;
      const v = view();
      const mode = wantsTrusted(action) ? "trusted" : "synthetic";
      const by = async (dx, dy) => {
        if (scroller && !inView(scroller)) {
          scrollToCentre(scroller);
          await frame();
        }
        if (mode === "trusted") {
          const at = scroller ? centreOf(rectOf(scroller)) : { x: (v?.innerWidth ?? 0) / 2, y: (v?.innerHeight ?? 0) / 2 };
          if (!instant) await overlay.pointerTo({ x: at.x, y: at.y, w: 0, h: 0 }, signal);
          await host({ kind: "wheel", x: at.x, y: at.y, dx, dy }, at);
        } else if (scroller) scroller.scrollBy({ left: dx, top: dy, behavior: instant ? "instant" : "smooth" });
        else v?.scrollBy({ left: dx, top: dy, behavior: instant ? "instant" : "smooth" });
        if (!instant) await settle(signal);
        else await frame();
      };
      if (action.to !== void 0) {
        if (action.to === "top" || action.to === "bottom") {
          const target = scroller ?? doc().scrollingElement ?? doc().documentElement;
          const top = action.to === "top" ? 0 : target.scrollHeight;
          target.scrollTo({ top, behavior: instant ? "instant" : "smooth" });
        } else {
          const el = await locate(action, action.to, signal ? { signal } : {});
          scrollToCentre(el);
        }
        if (!instant) await settle(signal);
        else await frame();
      }
      if (action.by) await by(action.by.x ?? 0, action.by.y ?? 0);
      if (action.until) {
        const until = action.until;
        const named2 = anchorOf(until);
        const satisfied = () => {
          if (!evaluate(until, readyCtx())) return false;
          if (!named2) return true;
          const el = resolve(named2, ctx);
          return el !== null && inView(el);
        };
        const step = action.by?.y ?? Math.round(((scroller ? rectOf(scroller).h : v?.innerHeight ?? 600) || 600) * 0.6);
        const max = action.maxSteps ?? 20;
        for (let i = 0; i < max && !satisfied(); i++) {
          throwIfAborted(signal);
          await by(action.by?.x ?? 0, step);
        }
        if (!satisfied()) {
          await waitFor(until, { clock: deps.wall, ctx: readyCtx(), timeoutMs: Math.min(readyMs(action), 2e3), ...signal ? { signal } : {} });
          if (!satisfied()) throw new ActionError(action, `still not in view after ${max} scroll steps`, named2 ? describeAnchor(named2, ctx.anchors) : null);
        }
      }
      return mode;
    }
    async function spotlight(action, signal) {
      const el = await locate(action, action.target, signal ? { signal } : {});
      if (!inView(el)) {
        scrollToCentre(el);
        await frame();
      }
      overlay.spotlight({ rect: rectOf(el), callout: action.callout ?? null, element: el });
    }
    async function perform(action, instant, signal) {
      switch (action.kind) {
        case "goto": {
          const url = action.url;
          if (deps.navigate) await deps.navigate(url, signal);
          else view()?.location.assign(url);
          return null;
        }
        case "click":
          return click(action, instant, signal);
        case "type":
          return typeInto(action, instant, signal);
        case "select":
          return select(action, instant, signal);
        case "check":
          return check(action, instant, signal);
        case "hover":
          return hover(action, instant, signal);
        case "focus": {
          const el = await locate(action, action.target, signal ? { signal } : {});
          await approach(el, instant, signal);
          el.focus?.();
          return null;
        }
        case "key":
          return key(action, instant, signal);
        case "press":
          return press(action, instant, signal);
        case "drag":
          return drag(action, instant, signal);
        case "upload":
          return upload(action, instant, signal);
        case "scroll":
          return scroll(action, instant, signal);
        case "spotlight":
          await spotlight(action, signal);
          return null;
        case "wait":
          if (action.ms !== void 0 && !instant) await deps.pace.sleep(action.ms, signal);
          if (action.until) await waitFor(action.until, { clock: deps.wall, ctx: readyCtx(), timeoutMs: readyMs(action), ...signal ? { signal } : {} });
          return null;
        case "hold":
          if (!instant) await deps.pace.sleep(action.ms, signal);
          return null;
        case "card":
          overlay.card({ title: action.title, lines: action.lines ?? [] });
          if (action.ms !== void 0 && !instant) await deps.pace.sleep(action.ms, signal);
          return null;
        case "invoke":
          if (!deps.invoke) throw new ActionError(action, `no adapter registered for invoke '${action.name}'`);
          await deps.invoke(action.name, action.args);
          return null;
        case "camera": {
          if (action.end || !action.target) {
            deps.onCamera?.({ rect: null, scale: 1, easeMs: CAMERA_EASE_MS });
            return null;
          }
          const el = await locate(action, action.target, signal ? { signal } : {});
          if (!inView(el)) {
            scrollToCentre(el);
            await frame();
          }
          deps.onCamera?.({ rect: rectOf(el), scale: action.scale ?? 1.5, easeMs: CAMERA_EASE_MS });
          return null;
        }
      }
    }
    function isDone(action, options = {}) {
      if (action.effect === "write" && options.key && options.journal?.has(options.key)) return true;
      if (!action.done) return false;
      try {
        return evaluate(action.done, readyCtx());
      } catch {
        return false;
      }
    }
    return {
      isDone,
      async runAction(action, options = {}) {
        const { instant = false, signal, journal, key: jkey } = options;
        throwIfAborted(signal);
        ceiling = options.maxWaitMs ?? Number.POSITIVE_INFINITY;
        if (instant && isCosmetic(action)) {
          deps.onPhase?.(action, "skipped");
          return "skipped";
        }
        if (isDone(action, { ...journal ? { journal } : {}, ...jkey ? { key: jkey } : {} })) {
          if (action.effect === "write" && jkey) journal?.add(jkey);
          const result = action.done ? anchorOf(action.done) : null;
          if (!instant && result) {
            const el = resolve(result, ctx);
            if (el) {
              if (!inView(el)) {
                scrollToCentre(el);
                await frame();
              }
              overlay.spotlight({ rect: rectOf(el), callout: null, element: el });
            }
          }
          deps.onPhase?.(action, "skipped");
          return "skipped";
        }
        deps.onPhase?.(action, "start");
        let mode = null;
        try {
          mode = await perform(action, instant, signal);
          if (action.done) {
            await waitFor(action.done, { clock: deps.wall, ctx: readyCtx(), timeoutMs: readyMs(action), ...signal ? { signal } : {} });
          }
        } catch (e) {
          if (e instanceof ReadyTimeout) {
            deps.onPhase?.(action, "timeout", mode ?? void 0);
            throw new ActionError(action, e.message, e.anchor);
          }
          if (e instanceof ActionError && e.message.includes("within")) deps.onPhase?.(action, "timeout");
          throw e;
        } finally {
          const active = doc().activeElement;
          if (active?.tagName === "IFRAME") view()?.focus();
        }
        if (action.effect === "write" && jkey) journal?.add(jkey);
        deps.onPhase?.(action, "done", mode ?? void 0);
        return "done";
      },
      clear() {
        if (hovered) hoverOff(hovered);
        hovered = null;
        overlay.spotlight(null);
        overlay.card(null);
      }
    };
  }

  // toolkit/schema/tour.schema.json
  var tour_schema_default = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://github.com/AgentBlitz/cc-star-skills/plugins/showcase/tour.schema.json",
    title: "showcase tour",
    description: "A showcase tour (format 1): steps of beats, each with narration and the actions performed while it is spoken. See `showcase docs tour-format`.",
    type: "object",
    additionalProperties: false,
    required: [
      "showcase",
      "id",
      "title",
      "meta",
      "steps"
    ],
    properties: {
      $schema: {
        type: "string"
      },
      showcase: {
        const: 1,
        description: "The format version."
      },
      id: {
        $ref: "#/$defs/id",
        description: "The tour's id: file name, storyboard, voice manifest and output folder."
      },
      title: {
        type: "string",
        minLength: 1
      },
      meta: {
        $ref: "#/$defs/meta"
      },
      anchors: {
        type: "object",
        description: "Named anchors, referenced as `@name`.",
        propertyNames: {
          pattern: "^[A-Za-z][A-Za-z0-9_-]*$"
        },
        additionalProperties: {
          $ref: "#/$defs/anchor"
        }
      },
      steps: {
        type: "array",
        minItems: 1,
        items: {
          $ref: "#/$defs/step"
        }
      }
    },
    $defs: {
      id: {
        type: "string",
        pattern: "^[a-z0-9][a-z0-9-]*$"
      },
      date: {
        type: "string",
        pattern: "^\\d{4}-\\d{2}-\\d{2}$"
      },
      textMatch: {
        type: "object",
        additionalProperties: false,
        required: [
          "pattern"
        ],
        properties: {
          pattern: {
            type: "string",
            minLength: 1
          },
          flags: {
            type: "string",
            pattern: "^[imsu]*$"
          }
        }
      },
      textOrMatch: {
        anyOf: [
          {
            type: "string",
            minLength: 1
          },
          {
            $ref: "#/$defs/textMatch"
          }
        ]
      },
      offset: {
        type: "object",
        additionalProperties: false,
        minProperties: 1,
        properties: {
          x: {
            type: "number"
          },
          y: {
            type: "number"
          }
        }
      },
      meta: {
        type: "object",
        additionalProperties: false,
        required: [
          "kind",
          "audience",
          "afterwards",
          "language",
          "length"
        ],
        properties: {
          kind: {
            enum: [
              "pitch",
              "walkthrough",
              "spotlight",
              "howto"
            ]
          },
          audience: {
            enum: [
              "executives",
              "users",
              "team",
              "developers"
            ]
          },
          afterwards: {
            enum: [
              "decide",
              "try",
              "understand",
              "champion"
            ]
          },
          takeaway: {
            type: "string",
            minLength: 1,
            description: "What the viewer should believe afterwards, in one line."
          },
          language: {
            type: "string",
            pattern: "^[a-z]{2}(-[A-Z]{2})?$",
            description: "BCP 47, e.g. en-GB."
          },
          length: {
            type: "object",
            additionalProperties: false,
            required: [
              "targetSec"
            ],
            properties: {
              targetSec: {
                type: "integer",
                minimum: 10,
                maximum: 900,
                description: "The film's target length. The presets are 60, 90, 120, 180 and 300."
              },
              narration: {
                $ref: "#/$defs/range",
                description: "Override the narration window, in seconds of readingMs."
              },
              beats: {
                $ref: "#/$defs/range",
                description: "Override the beat count range."
              }
            }
          },
          rules: {
            type: "object",
            additionalProperties: false,
            properties: {
              spokenNumbers: {
                enum: [
                  "on-screen-only",
                  "none"
                ],
                default: "on-screen-only"
              },
              firstToCut: {
                $ref: "#/$defs/id",
                description: "The beat to drop first if the film runs long. Required from 2:00."
              }
            }
          },
          approved: {
            type: "object",
            additionalProperties: false,
            description: "Approval dates, recorded by the skill.",
            properties: {
              storyboard: {
                $ref: "#/$defs/date"
              },
              narrator: {
                $ref: "#/$defs/date"
              },
              final: {
                $ref: "#/$defs/date"
              }
            }
          }
        }
      },
      anchor: {
        type: "object",
        additionalProperties: false,
        minProperties: 1,
        description: "Find an element. Preference: role and name, label, test id, text, CSS.",
        properties: {
          role: {
            type: "string",
            minLength: 1,
            description: "An ARIA role, e.g. button, link, textbox."
          },
          name: {
            $ref: "#/$defs/textOrMatch",
            description: "The accessible name (with role)."
          },
          label: {
            $ref: "#/$defs/textOrMatch",
            description: "A form control's label."
          },
          testId: {
            type: "string",
            minLength: 1
          },
          text: {
            $ref: "#/$defs/textOrMatch",
            description: "Visible text; with css, a filter."
          },
          css: {
            type: "string",
            minLength: 1
          },
          exact: {
            type: "boolean",
            description: "Match name, label and text exactly (default: contains, case-insensitive)."
          },
          nth: {
            type: "integer",
            description: "Which match: 0 the first, -1 the last. Default 0."
          },
          within: {
            $ref: "#/$defs/anchorRef",
            description: "Look inside this element only."
          },
          frame: {
            type: "string",
            minLength: 1,
            description: "A same-origin iframe (CSS in the top document)."
          }
        },
        dependentRequired: {
          name: [
            "role"
          ]
        },
        anyOf: [
          {
            required: [
              "role"
            ]
          },
          {
            required: [
              "label"
            ]
          },
          {
            required: [
              "testId"
            ]
          },
          {
            required: [
              "text"
            ]
          },
          {
            required: [
              "css"
            ]
          }
        ]
      },
      anchorRef: {
        anyOf: [
          {
            type: "string",
            pattern: "^@[A-Za-z][A-Za-z0-9_-]*$"
          },
          {
            $ref: "#/$defs/anchor"
          }
        ]
      },
      range: {
        type: "object",
        additionalProperties: false,
        required: [
          "min",
          "max"
        ],
        properties: {
          min: {
            type: "number",
            minimum: 0
          },
          max: {
            type: "number",
            minimum: 0
          }
        }
      },
      ready: {
        oneOf: [
          {
            title: "visible",
            type: "object",
            additionalProperties: false,
            required: [
              "kind",
              "anchor"
            ],
            properties: {
              kind: {
                const: "visible"
              },
              anchor: {
                $ref: "#/$defs/anchorRef"
              }
            }
          },
          {
            title: "exists",
            type: "object",
            additionalProperties: false,
            required: [
              "kind",
              "anchor"
            ],
            properties: {
              kind: {
                const: "exists"
              },
              anchor: {
                $ref: "#/$defs/anchorRef"
              }
            }
          },
          {
            title: "enabled",
            type: "object",
            additionalProperties: false,
            required: [
              "kind",
              "anchor"
            ],
            properties: {
              kind: {
                const: "enabled"
              },
              anchor: {
                $ref: "#/$defs/anchorRef"
              }
            }
          },
          {
            title: "absent",
            type: "object",
            additionalProperties: false,
            required: [
              "kind",
              "anchor"
            ],
            properties: {
              kind: {
                const: "absent"
              },
              anchor: {
                $ref: "#/$defs/anchorRef"
              }
            }
          },
          {
            title: "attr",
            type: "object",
            additionalProperties: false,
            required: [
              "kind",
              "anchor",
              "name"
            ],
            properties: {
              kind: {
                const: "attr"
              },
              anchor: {
                $ref: "#/$defs/anchorRef"
              },
              name: {
                type: "string",
                minLength: 1
              },
              prop: {
                type: "boolean"
              },
              equals: {
                type: "string"
              },
              contains: {
                type: "string"
              },
              matches: {
                $ref: "#/$defs/textMatch"
              },
              nonEmpty: {
                type: "boolean"
              }
            },
            anyOf: [
              {
                required: [
                  "equals"
                ]
              },
              {
                required: [
                  "contains"
                ]
              },
              {
                required: [
                  "matches"
                ]
              },
              {
                required: [
                  "nonEmpty"
                ]
              }
            ]
          },
          {
            title: "text",
            type: "object",
            additionalProperties: false,
            required: [
              "kind",
              "anchor"
            ],
            properties: {
              kind: {
                const: "text"
              },
              anchor: {
                $ref: "#/$defs/anchorRef"
              },
              equals: {
                type: "string"
              },
              contains: {
                type: "string"
              },
              matches: {
                $ref: "#/$defs/textMatch"
              }
            },
            anyOf: [
              {
                required: [
                  "equals"
                ]
              },
              {
                required: [
                  "contains"
                ]
              },
              {
                required: [
                  "matches"
                ]
              }
            ]
          },
          {
            title: "count",
            type: "object",
            additionalProperties: false,
            required: [
              "kind",
              "anchor"
            ],
            properties: {
              kind: {
                const: "count"
              },
              anchor: {
                $ref: "#/$defs/anchorRef"
              },
              min: {
                type: "integer",
                minimum: 0
              },
              max: {
                type: "integer",
                minimum: 0
              }
            },
            anyOf: [
              {
                required: [
                  "min"
                ]
              },
              {
                required: [
                  "max"
                ]
              }
            ]
          },
          {
            title: "url",
            type: "object",
            additionalProperties: false,
            required: [
              "kind"
            ],
            properties: {
              kind: {
                const: "url"
              },
              path: {
                type: "string",
                pattern: "^/"
              },
              params: {
                type: "object",
                additionalProperties: {
                  type: "string"
                }
              }
            },
            anyOf: [
              {
                required: [
                  "path"
                ]
              },
              {
                required: [
                  "params"
                ]
              }
            ]
          },
          {
            title: "all",
            type: "object",
            additionalProperties: false,
            required: [
              "kind",
              "of"
            ],
            properties: {
              kind: {
                const: "all"
              },
              of: {
                type: "array",
                minItems: 1,
                items: {
                  $ref: "#/$defs/ready"
                }
              }
            }
          },
          {
            title: "any",
            type: "object",
            additionalProperties: false,
            required: [
              "kind",
              "of"
            ],
            properties: {
              kind: {
                const: "any"
              },
              of: {
                type: "array",
                minItems: 1,
                items: {
                  $ref: "#/$defs/ready"
                }
              }
            }
          }
        ]
      },
      sentence: {
        anyOf: [
          {
            type: "string",
            minLength: 1
          },
          {
            type: "object",
            additionalProperties: false,
            required: [
              "text",
              "after"
            ],
            properties: {
              text: {
                type: "string",
                minLength: 1
              },
              after: {
                $ref: "#/$defs/id",
                description: "Start this sentence once that action of the beat is done."
              }
            }
          }
        ]
      },
      card: {
        type: "object",
        additionalProperties: false,
        required: [
          "title"
        ],
        properties: {
          title: {
            type: "string",
            minLength: 1
          },
          lines: {
            type: "array",
            items: {
              type: "string",
              minLength: 1
            }
          }
        }
      },
      action: {
        oneOf: [
          {
            title: "goto",
            description: "Go to a URL.",
            type: "object",
            additionalProperties: false,
            required: [
              "id",
              "kind",
              "url"
            ],
            properties: {
              kind: {
                const: "goto"
              },
              id: {
                $ref: "#/$defs/id",
                description: "Unique within its beat. A sentence's `after` names it."
              },
              label: {
                type: "string",
                minLength: 1,
                description: "What the action does, in words: the storyboard and the report show it."
              },
              effect: {
                enum: [
                  "read",
                  "write"
                ],
                default: "read",
                description: "A write changes the app's state and needs `done` (C6)."
              },
              done: {
                $ref: "#/$defs/ready",
                description: "Holds once the action has taken effect. Already holding means the action is skipped."
              },
              timeoutMs: {
                type: "integer",
                minimum: 1,
                description: "How long the target or `done` may take. Default 10 s for a target."
              },
              navigates: {
                type: "boolean",
                description: "The action causes a full page load. It must be the last action of its beat, and runs after the beat's narration."
              },
              input: {
                enum: [
                  "trusted",
                  "synthetic"
                ],
                description: "Override how input is delivered (injected runs default to trusted)."
              },
              url: {
                type: "string",
                minLength: 1,
                description: "A path (`/search?q=x`) or an absolute URL."
              }
            }
          },
          {
            title: "click",
            description: "Click the target with the visible pointer.",
            type: "object",
            additionalProperties: false,
            required: [
              "id",
              "kind",
              "target"
            ],
            properties: {
              kind: {
                const: "click"
              },
              id: {
                $ref: "#/$defs/id",
                description: "Unique within its beat. A sentence's `after` names it."
              },
              label: {
                type: "string",
                minLength: 1,
                description: "What the action does, in words: the storyboard and the report show it."
              },
              effect: {
                enum: [
                  "read",
                  "write"
                ],
                default: "read",
                description: "A write changes the app's state and needs `done` (C6)."
              },
              done: {
                $ref: "#/$defs/ready",
                description: "Holds once the action has taken effect. Already holding means the action is skipped."
              },
              timeoutMs: {
                type: "integer",
                minimum: 1,
                description: "How long the target or `done` may take. Default 10 s for a target."
              },
              navigates: {
                type: "boolean",
                description: "The action causes a full page load. It must be the last action of its beat, and runs after the beat's narration."
              },
              input: {
                enum: [
                  "trusted",
                  "synthetic"
                ],
                description: "Override how input is delivered (injected runs default to trusted)."
              },
              target: {
                $ref: "#/$defs/anchorRef",
                description: "The element: an `@name` or an inline anchor."
              },
              button: {
                enum: [
                  "left",
                  "right",
                  "middle"
                ]
              },
              count: {
                type: "integer",
                minimum: 1,
                maximum: 3
              }
            }
          },
          {
            title: "type",
            description: "Type into a field, then blur it.",
            type: "object",
            additionalProperties: false,
            required: [
              "id",
              "kind",
              "target",
              "text"
            ],
            properties: {
              kind: {
                const: "type"
              },
              id: {
                $ref: "#/$defs/id",
                description: "Unique within its beat. A sentence's `after` names it."
              },
              label: {
                type: "string",
                minLength: 1,
                description: "What the action does, in words: the storyboard and the report show it."
              },
              effect: {
                enum: [
                  "read",
                  "write"
                ],
                default: "read",
                description: "A write changes the app's state and needs `done` (C6)."
              },
              done: {
                $ref: "#/$defs/ready",
                description: "Holds once the action has taken effect. Already holding means the action is skipped."
              },
              timeoutMs: {
                type: "integer",
                minimum: 1,
                description: "How long the target or `done` may take. Default 10 s for a target."
              },
              navigates: {
                type: "boolean",
                description: "The action causes a full page load. It must be the last action of its beat, and runs after the beat's narration."
              },
              input: {
                enum: [
                  "trusted",
                  "synthetic"
                ],
                description: "Override how input is delivered (injected runs default to trusted)."
              },
              target: {
                $ref: "#/$defs/anchorRef",
                description: "The element: an `@name` or an inline anchor."
              },
              text: {
                type: "string"
              },
              append: {
                type: "boolean"
              },
              submit: {
                enum: [
                  "enter",
                  "button"
                ]
              }
            }
          },
          {
            title: "select",
            description: "Pick an option of a select.",
            type: "object",
            additionalProperties: false,
            required: [
              "id",
              "kind",
              "target"
            ],
            properties: {
              kind: {
                const: "select"
              },
              id: {
                $ref: "#/$defs/id",
                description: "Unique within its beat. A sentence's `after` names it."
              },
              label: {
                type: "string",
                minLength: 1,
                description: "What the action does, in words: the storyboard and the report show it."
              },
              effect: {
                enum: [
                  "read",
                  "write"
                ],
                default: "read",
                description: "A write changes the app's state and needs `done` (C6)."
              },
              done: {
                $ref: "#/$defs/ready",
                description: "Holds once the action has taken effect. Already holding means the action is skipped."
              },
              timeoutMs: {
                type: "integer",
                minimum: 1,
                description: "How long the target or `done` may take. Default 10 s for a target."
              },
              navigates: {
                type: "boolean",
                description: "The action causes a full page load. It must be the last action of its beat, and runs after the beat's narration."
              },
              input: {
                enum: [
                  "trusted",
                  "synthetic"
                ],
                description: "Override how input is delivered (injected runs default to trusted)."
              },
              target: {
                $ref: "#/$defs/anchorRef",
                description: "The element: an `@name` or an inline anchor."
              },
              value: {
                type: "string"
              },
              option: {
                type: "string",
                minLength: 1,
                description: "The option's visible label, when there's no value."
              }
            },
            anyOf: [
              {
                required: [
                  "value"
                ]
              },
              {
                required: [
                  "option"
                ]
              }
            ]
          },
          {
            title: "check",
            description: "Check or uncheck a checkbox, radio or switch.",
            type: "object",
            additionalProperties: false,
            required: [
              "id",
              "kind",
              "target"
            ],
            properties: {
              kind: {
                const: "check"
              },
              id: {
                $ref: "#/$defs/id",
                description: "Unique within its beat. A sentence's `after` names it."
              },
              label: {
                type: "string",
                minLength: 1,
                description: "What the action does, in words: the storyboard and the report show it."
              },
              effect: {
                enum: [
                  "read",
                  "write"
                ],
                default: "read",
                description: "A write changes the app's state and needs `done` (C6)."
              },
              done: {
                $ref: "#/$defs/ready",
                description: "Holds once the action has taken effect. Already holding means the action is skipped."
              },
              timeoutMs: {
                type: "integer",
                minimum: 1,
                description: "How long the target or `done` may take. Default 10 s for a target."
              },
              navigates: {
                type: "boolean",
                description: "The action causes a full page load. It must be the last action of its beat, and runs after the beat's narration."
              },
              input: {
                enum: [
                  "trusted",
                  "synthetic"
                ],
                description: "Override how input is delivered (injected runs default to trusted)."
              },
              target: {
                $ref: "#/$defs/anchorRef",
                description: "The element: an `@name` or an inline anchor."
              },
              checked: {
                type: "boolean",
                default: true
              }
            }
          },
          {
            title: "hover",
            description: "Move the pointer onto the target.",
            type: "object",
            additionalProperties: false,
            required: [
              "id",
              "kind",
              "target"
            ],
            properties: {
              kind: {
                const: "hover"
              },
              id: {
                $ref: "#/$defs/id",
                description: "Unique within its beat. A sentence's `after` names it."
              },
              label: {
                type: "string",
                minLength: 1,
                description: "What the action does, in words: the storyboard and the report show it."
              },
              effect: {
                enum: [
                  "read",
                  "write"
                ],
                default: "read",
                description: "A write changes the app's state and needs `done` (C6)."
              },
              done: {
                $ref: "#/$defs/ready",
                description: "Holds once the action has taken effect. Already holding means the action is skipped."
              },
              timeoutMs: {
                type: "integer",
                minimum: 1,
                description: "How long the target or `done` may take. Default 10 s for a target."
              },
              navigates: {
                type: "boolean",
                description: "The action causes a full page load. It must be the last action of its beat, and runs after the beat's narration."
              },
              input: {
                enum: [
                  "trusted",
                  "synthetic"
                ],
                description: "Override how input is delivered (injected runs default to trusted)."
              },
              target: {
                $ref: "#/$defs/anchorRef",
                description: "The element: an `@name` or an inline anchor."
              }
            }
          },
          {
            title: "focus",
            description: "Focus the target.",
            type: "object",
            additionalProperties: false,
            required: [
              "id",
              "kind",
              "target"
            ],
            properties: {
              kind: {
                const: "focus"
              },
              id: {
                $ref: "#/$defs/id",
                description: "Unique within its beat. A sentence's `after` names it."
              },
              label: {
                type: "string",
                minLength: 1,
                description: "What the action does, in words: the storyboard and the report show it."
              },
              effect: {
                enum: [
                  "read",
                  "write"
                ],
                default: "read",
                description: "A write changes the app's state and needs `done` (C6)."
              },
              done: {
                $ref: "#/$defs/ready",
                description: "Holds once the action has taken effect. Already holding means the action is skipped."
              },
              timeoutMs: {
                type: "integer",
                minimum: 1,
                description: "How long the target or `done` may take. Default 10 s for a target."
              },
              navigates: {
                type: "boolean",
                description: "The action causes a full page load. It must be the last action of its beat, and runs after the beat's narration."
              },
              input: {
                enum: [
                  "trusted",
                  "synthetic"
                ],
                description: "Override how input is delivered (injected runs default to trusted)."
              },
              target: {
                $ref: "#/$defs/anchorRef",
                description: "The element: an `@name` or an inline anchor."
              }
            }
          },
          {
            title: "key",
            description: "Press a key: the last resort, when the control has no visible form.",
            type: "object",
            additionalProperties: false,
            required: [
              "id",
              "kind",
              "key"
            ],
            properties: {
              kind: {
                const: "key"
              },
              id: {
                $ref: "#/$defs/id",
                description: "Unique within its beat. A sentence's `after` names it."
              },
              label: {
                type: "string",
                minLength: 1,
                description: "What the action does, in words: the storyboard and the report show it."
              },
              effect: {
                enum: [
                  "read",
                  "write"
                ],
                default: "read",
                description: "A write changes the app's state and needs `done` (C6)."
              },
              done: {
                $ref: "#/$defs/ready",
                description: "Holds once the action has taken effect. Already holding means the action is skipped."
              },
              timeoutMs: {
                type: "integer",
                minimum: 1,
                description: "How long the target or `done` may take. Default 10 s for a target."
              },
              navigates: {
                type: "boolean",
                description: "The action causes a full page load. It must be the last action of its beat, and runs after the beat's narration."
              },
              input: {
                enum: [
                  "trusted",
                  "synthetic"
                ],
                description: "Override how input is delivered (injected runs default to trusted)."
              },
              key: {
                type: "string",
                minLength: 1,
                description: "A key or chord, Playwright-style: `Enter`, `Control+K`."
              },
              target: {
                $ref: "#/$defs/anchorRef",
                description: "The element: an `@name` or an inline anchor."
              }
            }
          },
          {
            title: "press",
            description: "Press and hold the pointer on the target (a long press).",
            type: "object",
            additionalProperties: false,
            required: [
              "id",
              "kind",
              "target"
            ],
            properties: {
              kind: {
                const: "press"
              },
              id: {
                $ref: "#/$defs/id",
                description: "Unique within its beat. A sentence's `after` names it."
              },
              label: {
                type: "string",
                minLength: 1,
                description: "What the action does, in words: the storyboard and the report show it."
              },
              effect: {
                enum: [
                  "read",
                  "write"
                ],
                default: "read",
                description: "A write changes the app's state and needs `done` (C6)."
              },
              done: {
                $ref: "#/$defs/ready",
                description: "Holds once the action has taken effect. Already holding means the action is skipped."
              },
              timeoutMs: {
                type: "integer",
                minimum: 1,
                description: "How long the target or `done` may take. Default 10 s for a target."
              },
              navigates: {
                type: "boolean",
                description: "The action causes a full page load. It must be the last action of its beat, and runs after the beat's narration."
              },
              input: {
                enum: [
                  "trusted",
                  "synthetic"
                ],
                description: "Override how input is delivered (injected runs default to trusted)."
              },
              target: {
                $ref: "#/$defs/anchorRef",
                description: "The element: an `@name` or an inline anchor."
              },
              ms: {
                type: "integer",
                minimum: 1,
                default: 800
              }
            }
          },
          {
            title: "drag",
            description: "Drag the target onto another element, or by an offset.",
            type: "object",
            additionalProperties: false,
            required: [
              "id",
              "kind",
              "target"
            ],
            properties: {
              kind: {
                const: "drag"
              },
              id: {
                $ref: "#/$defs/id",
                description: "Unique within its beat. A sentence's `after` names it."
              },
              label: {
                type: "string",
                minLength: 1,
                description: "What the action does, in words: the storyboard and the report show it."
              },
              effect: {
                enum: [
                  "read",
                  "write"
                ],
                default: "read",
                description: "A write changes the app's state and needs `done` (C6)."
              },
              done: {
                $ref: "#/$defs/ready",
                description: "Holds once the action has taken effect. Already holding means the action is skipped."
              },
              timeoutMs: {
                type: "integer",
                minimum: 1,
                description: "How long the target or `done` may take. Default 10 s for a target."
              },
              navigates: {
                type: "boolean",
                description: "The action causes a full page load. It must be the last action of its beat, and runs after the beat's narration."
              },
              input: {
                enum: [
                  "trusted",
                  "synthetic"
                ],
                description: "Override how input is delivered (injected runs default to trusted)."
              },
              target: {
                $ref: "#/$defs/anchorRef",
                description: "The element: an `@name` or an inline anchor."
              },
              to: {
                $ref: "#/$defs/anchorRef"
              },
              by: {
                $ref: "#/$defs/offset"
              }
            },
            anyOf: [
              {
                required: [
                  "to"
                ]
              },
              {
                required: [
                  "by"
                ]
              }
            ]
          },
          {
            title: "upload",
            description: "Choose files for a file input or chooser.",
            type: "object",
            additionalProperties: false,
            required: [
              "id",
              "kind",
              "target",
              "files"
            ],
            properties: {
              kind: {
                const: "upload"
              },
              id: {
                $ref: "#/$defs/id",
                description: "Unique within its beat. A sentence's `after` names it."
              },
              label: {
                type: "string",
                minLength: 1,
                description: "What the action does, in words: the storyboard and the report show it."
              },
              effect: {
                enum: [
                  "read",
                  "write"
                ],
                default: "read",
                description: "A write changes the app's state and needs `done` (C6)."
              },
              done: {
                $ref: "#/$defs/ready",
                description: "Holds once the action has taken effect. Already holding means the action is skipped."
              },
              timeoutMs: {
                type: "integer",
                minimum: 1,
                description: "How long the target or `done` may take. Default 10 s for a target."
              },
              navigates: {
                type: "boolean",
                description: "The action causes a full page load. It must be the last action of its beat, and runs after the beat's narration."
              },
              input: {
                enum: [
                  "trusted",
                  "synthetic"
                ],
                description: "Override how input is delivered (injected runs default to trusted)."
              },
              target: {
                $ref: "#/$defs/anchorRef",
                description: "The element: an `@name` or an inline anchor."
              },
              files: {
                type: "array",
                minItems: 1,
                items: {
                  type: "string",
                  minLength: 1
                },
                description: "Paths relative to the repo's showcase/ dir."
              }
            }
          },
          {
            title: "scroll",
            description: "Scroll the page or a scroller.",
            type: "object",
            additionalProperties: false,
            required: [
              "id",
              "kind"
            ],
            properties: {
              kind: {
                const: "scroll"
              },
              id: {
                $ref: "#/$defs/id",
                description: "Unique within its beat. A sentence's `after` names it."
              },
              label: {
                type: "string",
                minLength: 1,
                description: "What the action does, in words: the storyboard and the report show it."
              },
              effect: {
                enum: [
                  "read",
                  "write"
                ],
                default: "read",
                description: "A write changes the app's state and needs `done` (C6)."
              },
              done: {
                $ref: "#/$defs/ready",
                description: "Holds once the action has taken effect. Already holding means the action is skipped."
              },
              timeoutMs: {
                type: "integer",
                minimum: 1,
                description: "How long the target or `done` may take. Default 10 s for a target."
              },
              navigates: {
                type: "boolean",
                description: "The action causes a full page load. It must be the last action of its beat, and runs after the beat's narration."
              },
              input: {
                enum: [
                  "trusted",
                  "synthetic"
                ],
                description: "Override how input is delivered (injected runs default to trusted)."
              },
              target: {
                $ref: "#/$defs/anchorRef",
                description: "The scroller. Default: the page."
              },
              to: {
                anyOf: [
                  {
                    enum: [
                      "top",
                      "bottom"
                    ]
                  },
                  {
                    $ref: "#/$defs/anchorRef"
                  }
                ]
              },
              by: {
                $ref: "#/$defs/offset"
              },
              until: {
                $ref: "#/$defs/ready",
                description: "Keep scrolling until this holds (virtualised lists)."
              },
              maxSteps: {
                type: "integer",
                minimum: 1
              }
            },
            anyOf: [
              {
                required: [
                  "to"
                ]
              },
              {
                required: [
                  "by"
                ]
              },
              {
                required: [
                  "until"
                ]
              }
            ]
          },
          {
            title: "spotlight",
            description: "Light up the target; it holds for its sentence and clears when the pointer moves on.",
            type: "object",
            additionalProperties: false,
            required: [
              "id",
              "kind",
              "target"
            ],
            properties: {
              kind: {
                const: "spotlight"
              },
              id: {
                $ref: "#/$defs/id",
                description: "Unique within its beat. A sentence's `after` names it."
              },
              label: {
                type: "string",
                minLength: 1,
                description: "What the action does, in words: the storyboard and the report show it."
              },
              effect: {
                enum: [
                  "read",
                  "write"
                ],
                default: "read",
                description: "A write changes the app's state and needs `done` (C6)."
              },
              done: {
                $ref: "#/$defs/ready",
                description: "Holds once the action has taken effect. Already holding means the action is skipped."
              },
              timeoutMs: {
                type: "integer",
                minimum: 1,
                description: "How long the target or `done` may take. Default 10 s for a target."
              },
              navigates: {
                type: "boolean",
                description: "The action causes a full page load. It must be the last action of its beat, and runs after the beat's narration."
              },
              input: {
                enum: [
                  "trusted",
                  "synthetic"
                ],
                description: "Override how input is delivered (injected runs default to trusted)."
              },
              target: {
                $ref: "#/$defs/anchorRef",
                description: "The element: an `@name` or an inline anchor."
              },
              callout: {
                type: "object",
                additionalProperties: false,
                required: [
                  "title",
                  "body"
                ],
                properties: {
                  title: {
                    type: "string",
                    minLength: 1
                  },
                  body: {
                    type: "string",
                    minLength: 1
                  }
                }
              }
            }
          },
          {
            title: "wait",
            description: "Wait a fixed time, or until a predicate holds.",
            type: "object",
            additionalProperties: false,
            required: [
              "id",
              "kind"
            ],
            properties: {
              kind: {
                const: "wait"
              },
              id: {
                $ref: "#/$defs/id",
                description: "Unique within its beat. A sentence's `after` names it."
              },
              label: {
                type: "string",
                minLength: 1,
                description: "What the action does, in words: the storyboard and the report show it."
              },
              effect: {
                enum: [
                  "read",
                  "write"
                ],
                default: "read",
                description: "A write changes the app's state and needs `done` (C6)."
              },
              done: {
                $ref: "#/$defs/ready",
                description: "Holds once the action has taken effect. Already holding means the action is skipped."
              },
              timeoutMs: {
                type: "integer",
                minimum: 1,
                description: "How long the target or `done` may take. Default 10 s for a target."
              },
              navigates: {
                type: "boolean",
                description: "The action causes a full page load. It must be the last action of its beat, and runs after the beat's narration."
              },
              input: {
                enum: [
                  "trusted",
                  "synthetic"
                ],
                description: "Override how input is delivered (injected runs default to trusted)."
              },
              ms: {
                type: "integer",
                minimum: 1
              },
              until: {
                $ref: "#/$defs/ready"
              }
            },
            anyOf: [
              {
                required: [
                  "ms"
                ]
              },
              {
                required: [
                  "until"
                ]
              }
            ]
          },
          {
            title: "hold",
            description: "Let it be seen: a pause on the tour's pace (fast-forward skips it).",
            type: "object",
            additionalProperties: false,
            required: [
              "id",
              "kind",
              "ms"
            ],
            properties: {
              kind: {
                const: "hold"
              },
              id: {
                $ref: "#/$defs/id",
                description: "Unique within its beat. A sentence's `after` names it."
              },
              label: {
                type: "string",
                minLength: 1,
                description: "What the action does, in words: the storyboard and the report show it."
              },
              effect: {
                enum: [
                  "read",
                  "write"
                ],
                default: "read",
                description: "A write changes the app's state and needs `done` (C6)."
              },
              done: {
                $ref: "#/$defs/ready",
                description: "Holds once the action has taken effect. Already holding means the action is skipped."
              },
              timeoutMs: {
                type: "integer",
                minimum: 1,
                description: "How long the target or `done` may take. Default 10 s for a target."
              },
              navigates: {
                type: "boolean",
                description: "The action causes a full page load. It must be the last action of its beat, and runs after the beat's narration."
              },
              input: {
                enum: [
                  "trusted",
                  "synthetic"
                ],
                description: "Override how input is delivered (injected runs default to trusted)."
              },
              ms: {
                type: "integer",
                minimum: 1
              }
            }
          },
          {
            title: "card",
            description: "Show a card over the screen mid-beat.",
            type: "object",
            additionalProperties: false,
            required: [
              "id",
              "kind",
              "title"
            ],
            properties: {
              kind: {
                const: "card"
              },
              id: {
                $ref: "#/$defs/id",
                description: "Unique within its beat. A sentence's `after` names it."
              },
              label: {
                type: "string",
                minLength: 1,
                description: "What the action does, in words: the storyboard and the report show it."
              },
              effect: {
                enum: [
                  "read",
                  "write"
                ],
                default: "read",
                description: "A write changes the app's state and needs `done` (C6)."
              },
              done: {
                $ref: "#/$defs/ready",
                description: "Holds once the action has taken effect. Already holding means the action is skipped."
              },
              timeoutMs: {
                type: "integer",
                minimum: 1,
                description: "How long the target or `done` may take. Default 10 s for a target."
              },
              navigates: {
                type: "boolean",
                description: "The action causes a full page load. It must be the last action of its beat, and runs after the beat's narration."
              },
              input: {
                enum: [
                  "trusted",
                  "synthetic"
                ],
                description: "Override how input is delivered (injected runs default to trusted)."
              },
              title: {
                type: "string",
                minLength: 1
              },
              lines: {
                type: "array",
                items: {
                  type: "string",
                  minLength: 1
                }
              },
              ms: {
                type: "integer",
                minimum: 1
              }
            }
          },
          {
            title: "invoke",
            description: "Call an adapter action (in-app only), where no DOM path exists.",
            type: "object",
            additionalProperties: false,
            required: [
              "id",
              "kind",
              "name"
            ],
            properties: {
              kind: {
                const: "invoke"
              },
              id: {
                $ref: "#/$defs/id",
                description: "Unique within its beat. A sentence's `after` names it."
              },
              label: {
                type: "string",
                minLength: 1,
                description: "What the action does, in words: the storyboard and the report show it."
              },
              effect: {
                enum: [
                  "read",
                  "write"
                ],
                default: "read",
                description: "A write changes the app's state and needs `done` (C6)."
              },
              done: {
                $ref: "#/$defs/ready",
                description: "Holds once the action has taken effect. Already holding means the action is skipped."
              },
              timeoutMs: {
                type: "integer",
                minimum: 1,
                description: "How long the target or `done` may take. Default 10 s for a target."
              },
              navigates: {
                type: "boolean",
                description: "The action causes a full page load. It must be the last action of its beat, and runs after the beat's narration."
              },
              input: {
                enum: [
                  "trusted",
                  "synthetic"
                ],
                description: "Override how input is delivered (injected runs default to trusted)."
              },
              name: {
                type: "string",
                minLength: 1
              },
              args: {
                type: "object"
              }
            }
          },
          {
            title: "camera",
            description: "Frame the film's camera. Accepted and ignored in v1 (D19).",
            type: "object",
            additionalProperties: false,
            required: [
              "id",
              "kind"
            ],
            properties: {
              kind: {
                const: "camera"
              },
              id: {
                $ref: "#/$defs/id",
                description: "Unique within its beat. A sentence's `after` names it."
              },
              label: {
                type: "string",
                minLength: 1,
                description: "What the action does, in words: the storyboard and the report show it."
              },
              effect: {
                enum: [
                  "read",
                  "write"
                ],
                default: "read",
                description: "A write changes the app's state and needs `done` (C6)."
              },
              done: {
                $ref: "#/$defs/ready",
                description: "Holds once the action has taken effect. Already holding means the action is skipped."
              },
              timeoutMs: {
                type: "integer",
                minimum: 1,
                description: "How long the target or `done` may take. Default 10 s for a target."
              },
              navigates: {
                type: "boolean",
                description: "The action causes a full page load. It must be the last action of its beat, and runs after the beat's narration."
              },
              input: {
                enum: [
                  "trusted",
                  "synthetic"
                ],
                description: "Override how input is delivered (injected runs default to trusted)."
              },
              target: {
                $ref: "#/$defs/anchorRef"
              },
              scale: {
                type: "number",
                minimum: 1,
                maximum: 2
              },
              end: {
                const: true
              }
            }
          }
        ]
      },
      beat: {
        type: "object",
        additionalProperties: false,
        required: [
          "id"
        ],
        properties: {
          id: {
            $ref: "#/$defs/id",
            description: "Unique within the tour: the voice manifest and film events key on it."
          },
          narration: {
            type: "array",
            items: {
              $ref: "#/$defs/sentence"
            }
          },
          actions: {
            type: "array",
            items: {
              $ref: "#/$defs/action"
            }
          },
          ready: {
            $ref: "#/$defs/ready",
            description: "What must hold before the beat ends."
          },
          dwellMs: {
            type: "integer",
            minimum: 0,
            description: "The pause after the beat."
          },
          card: {
            $ref: "#/$defs/card",
            description: "A title card instead of the screen."
          }
        }
      },
      step: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "beats"
        ],
        properties: {
          id: {
            $ref: "#/$defs/id"
          },
          title: {
            type: "string",
            minLength: 1
          },
          path: {
            type: "string",
            pattern: "^/",
            description: "Where the step happens; the tour goes there if it isn't already."
          },
          ready: {
            $ref: "#/$defs/ready",
            description: "What must hold on arrival, before the first beat."
          },
          beats: {
            type: "array",
            minItems: 1,
            items: {
              $ref: "#/$defs/beat"
            }
          }
        }
      }
    }
  };

  // toolkit/runtime/src/schema.ts
  var sentenceText = (s) => typeof s === "string" ? s : s.text;
  var KNOWN = /* @__PURE__ */ new Set([
    "$schema",
    "$id",
    "$defs",
    "$ref",
    "$comment",
    "title",
    "description",
    "default",
    "examples",
    "type",
    "properties",
    "required",
    "additionalProperties",
    "propertyNames",
    "minProperties",
    "dependentRequired",
    "items",
    "minItems",
    "maxItems",
    "enum",
    "const",
    "minLength",
    "maxLength",
    "pattern",
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "anyOf",
    "oneOf"
  ]);
  var typeOf = (v) => v === null ? "null" : Array.isArray(v) ? "array" : typeof v === "number" ? Number.isInteger(v) ? "integer" : "number" : typeof v;
  var isObj = (v) => typeOf(v) === "object";
  var show = (v) => JSON.stringify(v);
  function typeMatches(want, v) {
    const t = typeOf(v);
    return want === t || want === "number" && t === "integer";
  }
  var SchemaValidator = class {
    root;
    #patterns = /* @__PURE__ */ new Map();
    constructor(root) {
      this.root = root;
      this.#audit(root, "#");
    }
    /** Every unknown keyword is reported at construction, so a typo can't silently pass. */
    #audit(s, at) {
      if (!isObj(s)) return;
      for (const [k, v] of Object.entries(s)) {
        if (!KNOWN.has(k)) throw new Error(`schema keyword '${k}' at ${at} isn't supported`);
        if (k === "properties" || k === "$defs") {
          for (const [n, sub] of Object.entries(v)) this.#audit(sub, `${at}/${k}/${n}`);
        } else if (k === "anyOf" || k === "oneOf") v.forEach((sub, i) => this.#audit(sub, `${at}/${k}/${i}`));
        else if (k === "items" || k === "additionalProperties" || k === "propertyNames") this.#audit(v, `${at}/${k}`);
      }
    }
    #resolve(s) {
      let cur = s;
      for (let hops = 0; typeof cur.$ref === "string"; hops++) {
        const ref = cur.$ref;
        if (!ref.startsWith("#/") || hops > 32) throw new Error(`unsupported $ref '${ref}'`);
        let node = this.root;
        for (const part of ref.slice(2).split("/")) node = node?.[part];
        if (!isObj(node)) throw new Error(`unresolved $ref '${ref}'`);
        cur = node;
      }
      return cur;
    }
    #re(p) {
      let r = this.#patterns.get(p);
      if (!r) this.#patterns.set(p, r = new RegExp(p, "u"));
      return r;
    }
    validate(value, schema = this.root) {
      const errs = [];
      this.#check(value, schema, "", errs);
      return errs;
    }
    #check(v, raw, path, errs) {
      const s = this.#resolve(raw);
      const at = path || "/";
      if (s.type !== void 0) {
        const types = Array.isArray(s.type) ? s.type : [s.type];
        if (!types.some((t) => typeMatches(t, v))) {
          errs.push({ path: at, message: `must be ${types.join(" or ")}, not ${typeOf(v)}` });
          return;
        }
      }
      if ("const" in s && show(v) !== show(s.const)) errs.push({ path: at, message: `must be ${show(s.const)}` });
      if (Array.isArray(s.enum) && !s.enum.some((e) => show(e) === show(v)))
        errs.push({ path: at, message: `must be one of ${s.enum.map(show).join(", ")}, not ${show(v)}` });
      if (typeof v === "string") {
        if (typeof s.minLength === "number" && v.length < s.minLength) errs.push({ path: at, message: s.minLength === 1 ? "must not be empty" : `must be at least ${s.minLength} characters` });
        if (typeof s.maxLength === "number" && v.length > s.maxLength) errs.push({ path: at, message: `must be at most ${s.maxLength} characters` });
        if (typeof s.pattern === "string" && !this.#re(s.pattern).test(v)) errs.push({ path: at, message: `${show(v)} must match ${s.pattern}` });
      }
      if (typeof v === "number") {
        if (typeof s.minimum === "number" && v < s.minimum) errs.push({ path: at, message: `must be ≥ ${s.minimum}` });
        if (typeof s.maximum === "number" && v > s.maximum) errs.push({ path: at, message: `must be ≤ ${s.maximum}` });
        if (typeof s.exclusiveMinimum === "number" && v <= s.exclusiveMinimum) errs.push({ path: at, message: `must be > ${s.exclusiveMinimum}` });
      }
      if (Array.isArray(v)) {
        if (typeof s.minItems === "number" && v.length < s.minItems) errs.push({ path: at, message: `needs at least ${s.minItems} item${s.minItems === 1 ? "" : "s"}` });
        if (typeof s.maxItems === "number" && v.length > s.maxItems) errs.push({ path: at, message: `allows at most ${s.maxItems} items` });
        if (isObj(s.items)) v.forEach((item, i) => this.#check(item, s.items, `${path}/${i}`, errs));
      }
      if (isObj(v)) this.#object(v, s, path, errs);
      if (Array.isArray(s.anyOf)) this.#union(v, s.anyOf, path, errs, false);
      if (Array.isArray(s.oneOf)) this.#union(v, s.oneOf, path, errs, true);
    }
    #object(v, s, path, errs) {
      const at = path || "/";
      const props = s.properties ?? {};
      for (const r of s.required ?? []) if (!(r in v)) errs.push({ path: at, message: `needs '${r}'` });
      if (typeof s.minProperties === "number" && Object.keys(v).length < s.minProperties) errs.push({ path: at, message: "must not be empty" });
      for (const [k, needs] of Object.entries(s.dependentRequired ?? {}))
        if (k in v) {
          for (const n of needs) if (!(n in v)) errs.push({ path: at, message: `'${k}' needs '${n}'` });
        }
      for (const [k, val] of Object.entries(v)) {
        const sub = `${path}/${k}`;
        if (isObj(s.propertyNames)) for (const e of this.validate(k, s.propertyNames)) errs.push({ path: sub, message: `name ${e.message}` });
        if (k in props) this.#check(val, props[k], sub, errs);
        else if (s.additionalProperties === false) errs.push({ path: sub, message: `unknown property '${k}'` });
        else if (isObj(s.additionalProperties)) this.#check(val, s.additionalProperties, sub, errs);
      }
    }
    /**
     * `anyOf` / `oneOf`, with readable errors: branches discriminated by a `const` property (an
     * action's `kind`) report only the matching branch; otherwise the branch whose type fits.
     */
    #union(v, raw, path, errs, one) {
      const at = path || "/";
      const branches = raw.map((b) => this.#resolve(b));
      const passing = branches.filter((b) => this.#passes(v, b, path));
      if (passing.length === 1 || !one && passing.length > 1) return;
      if (one && passing.length > 1) {
        errs.push({ path: at, message: "matches more than one alternative" });
        return;
      }
      const disc = this.#discriminator(branches);
      if (disc && isObj(v)) {
        const hit = branches.find((b) => show(b.properties[disc]?.const) === show(v[disc]));
        if (hit) return this.#check(v, hit, path, errs);
        const options = branches.map((b) => show(b.properties[disc]?.const));
        errs.push({ path: `${path}/${disc}`, message: `must be one of ${options.join(", ")}${disc in v ? `, not ${show(v[disc])}` : ""}` });
        return;
      }
      if (branches.every((b) => Object.keys(b).every((k) => k === "required"))) {
        errs.push({ path: at, message: `needs one of ${branches.map((b) => b.required.map((r) => `'${r}'`).join("+")).join(", ")}` });
        return;
      }
      const fits = branches.filter((b) => b.type === void 0 || typeMatches(b.type, v));
      if (fits.length === 1) return this.#check(v, fits[0], path, errs);
      errs.push({ path: at, message: `doesn't match any allowed form (${branches.map((b) => b.title ?? b.type ?? "schema").join(", ")})` });
    }
    #passes(v, b, path) {
      const e = [];
      this.#check(v, b, path, e);
      return e.length === 0;
    }
    #discriminator(branches) {
      const first = branches[0]?.properties;
      if (!first) return null;
      for (const k of Object.keys(first)) {
        if (branches.every((b) => isObj(b.properties) && isObj(b.properties[k]) && "const" in b.properties[k])) return k;
      }
      return null;
    }
  };
  var tourSchema = tour_schema_default;
  var tourValidator = new SchemaValidator(tourSchema);

  // toolkit/runtime/src/narrative.ts
  var READING_WPM = 165;
  var READING_MIN_MS = 1600;
  function wordCount(text) {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }
  function readingMs(text) {
    return Math.max(READING_MIN_MS, Math.round(wordCount(text) * 6e4 / READING_WPM + 350));
  }
  var NUMBER_WORDS = "zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|a|half|a half";
  var MAGNITUDE = new RegExp(`\\b(?:(?:${NUMBER_WORDS})[\\s-]+)*(?:hundred|thousand|million|billion|trillion|percent|per cent)\\b`, "giu");

  // toolkit/runtime/src/narration.ts
  function findVoice(manifest, tour, beat, text) {
    if (!manifest || manifest.tour !== tour) return null;
    return manifest.clips.find((c) => c.beat === beat && c.text === text) ?? null;
  }
  function schedule(beat, options) {
    return (beat.narration ?? []).map((sentence, index) => {
      const text = sentenceText(sentence);
      const voice = findVoice(options.manifest, options.tour, beat.id, text);
      return {
        beat: beat.id,
        index,
        text,
        durationMs: voice?.durationMs ?? readingMs(text),
        audio: voice ? { hash: voice.hash, file: voice.file, durationMs: voice.durationMs } : null,
        after: typeof sentence === "string" ? null : sentence.after
      };
    });
  }
  function cuesMs(cues) {
    return cues.reduce((sum, c) => sum + c.durationMs, 0);
  }
  async function speak(cues, options) {
    let spoken = 0;
    for (const cue of cues) {
      throwIfAborted(options.signal);
      if (cue.after) await options.gate(cue.after);
      throwIfAborted(options.signal);
      if (options.audio && cue.audio) await options.audio.play(cue, options.signal);
      options.onStart?.(cue);
      try {
        await options.clock.sleep(cue.durationMs, options.signal);
        spoken += cue.durationMs;
      } finally {
        options.onEnd?.(cue);
      }
    }
    return spoken;
  }
  function narrationLines(tour) {
    return tour.steps.flatMap((step) => step.beats.flatMap((beat) => (beat.narration ?? []).map((s) => [tour.id, beat.id, sentenceText(s)])));
  }
  function narrationFingerprint(lines) {
    let h = 2166136261;
    const text = lines.map((l) => l.join("")).join("\n");
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  }

  // toolkit/runtime/src/state.ts
  var STATE_VERSION = 1;
  var STATE_MAX_AGE_MS = 2 * 60 * 60 * 1e3;
  function journalKey(step, beat, action) {
    return `${step}/${beat}/${action}`;
  }
  function isRunState(x) {
    if (typeof x !== "object" || x === null) return false;
    const s = x;
    return s.v === STATE_VERSION && typeof s.runId === "string" && typeof s.tourId === "string" && (s.mode === "watch" || s.mode === "film") && typeof s.speed === "number" && typeof s.stepIndex === "number" && typeof s.beatIndex === "number" && typeof s.at === "object" && s.at !== null && Array.isArray(s.journal) && typeof s.seq === "number" && typeof s.doc === "number";
  }
  var STORAGE_KEY = "showcase:run";
  function storageStore(storage, now = Date.now, key = STORAGE_KEY) {
    return {
      async load() {
        if (!storage) return null;
        try {
          const raw = storage.getItem(key);
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          if (!isRunState(parsed) || now() - parsed.startedAt > STATE_MAX_AGE_MS) {
            storage.removeItem(key);
            return null;
          }
          return parsed;
        } catch {
          return null;
        }
      },
      save(state) {
        try {
          storage?.setItem(key, JSON.stringify(state));
        } catch {
        }
      },
      clear() {
        try {
          storage?.removeItem(key);
        } catch {
        }
      }
    };
  }
  function hostStore(transport) {
    return {
      async load() {
        try {
          const got = await transport.load();
          return isRunState(got) ? got : null;
        } catch {
          return null;
        }
      },
      save: (state) => transport.save(state),
      clear: () => transport.clear()
    };
  }

  // toolkit/runtime/src/timeline.ts
  var FILM_STATES = {
    "film:armed": "armed",
    "film:start": "running",
    "film:end": "ended",
    "film:error": "error"
  };
  function createTimeline(options) {
    const view = options.window === void 0 ? typeof window === "undefined" ? null : window : options.window;
    const events = [];
    if (view) view[FILM_LOG_KEY] = events;
    return {
      events,
      emit(input) {
        const { seq, doc } = options.stamp();
        const event = { ...input, v: FILM_VERSION, seq, doc, t: options.t(), wall: options.wall() };
        events.push(event);
        const state = FILM_STATES[event.type];
        if (view && state) view.document.documentElement.dataset.showcaseFilm = state;
        try {
          options.send?.(event);
        } catch {
        }
        if (view) view.dispatchEvent(new CustomEvent(FILM_EVENT_NAME, { detail: event }));
        return event;
      }
    };
  }
  var NO_TIMELINE = {
    events: [],
    emit: (input) => ({ ...input, v: FILM_VERSION, seq: 0, doc: 0, t: 0, wall: 0 })
  };

  // toolkit/runtime/src/director.ts
  var DEFAULT_DWELL_MS = 600;
  var FILM_WAIT_MS = 15e3;
  var fresh = () => ({ action: 0, sentence: 0, speaking: null, stage: "begin" });
  var Director = class {
    deps;
    run = null;
    flow = null;
    settled = Promise.resolve();
    constructor(deps) {
      this.deps = deps;
    }
    get tour() {
      return this.deps.tour;
    }
    /** What the host and the overlay show. */
    get snapshot() {
      const r = this.run;
      if (!r) return null;
      const s = r.state;
      const step = this.deps.tour.steps[s.stepIndex] ?? this.deps.tour.steps[0];
      const beat = step?.beats[s.beatIndex] ?? null;
      const holding = s.paused && (r.base === "playing" || r.base === "entering");
      return {
        runId: s.runId,
        tourId: s.tourId,
        mode: s.mode,
        status: holding ? "paused" : r.base,
        stepIndex: s.stepIndex,
        stepId: step?.id ?? "",
        stepCount: this.deps.tour.steps.length,
        beatIndex: s.beatIndex,
        beatId: beat?.id ?? null,
        beatCount: step?.beats.length ?? 0,
        speed: s.speed,
        paused: s.paused,
        rolling: s.rolling,
        doc: s.doc,
        blocked: r.blocked,
        caption: r.caption,
        ended: r.ended,
        journal: [...r.journal],
        at: { ...s.at },
        notes: [...r.notes],
        muted: this.deps.audio?.muted ?? false
      };
    }
    /** The writes this run has made. */
    get journal() {
      return this.run ? [...this.run.journal] : [];
    }
    /** The film's events so far, in this document. */
    get events() {
      return this.run?.timeline.events ?? [];
    }
    /** Resolves once the flow in hand has settled. For tests. */
    idle() {
      return this.settled;
    }
    // ——— Starting and resuming ———
    /** Starts a run from the first step, or from the step named (a deep link: earlier writes are fast-forwarded). */
    start(options) {
      if (this.run && this.run.base !== "done") return;
      const tour = this.deps.tour;
      const stepIndex = options.from ? Math.max(0, tour.steps.findIndex((s) => s.id === options.from)) : 0;
      const state = {
        v: STATE_VERSION,
        runId: this.deps.newRunId?.() ?? `${this.deps.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        tourId: tour.id,
        mode: options.mode,
        speed: options.speed ?? 1,
        stepIndex,
        beatIndex: 0,
        at: fresh(),
        entered: false,
        target: null,
        journal: [],
        seq: 0,
        doc: this.deps.doc ?? 1,
        rolling: false,
        filmBeats: 0,
        paused: false,
        pointer: null,
        startedAt: this.deps.now()
      };
      this.run = this.newRun(state);
      this.launch(async (signal) => {
        const r = this.must();
        r.base = "starting";
        r.phase = "start";
        r.again = null;
        this.publish();
        if (stepIndex > 0) await this.prepare(signal, 0, stepIndex);
        await this.step(signal, stepIndex, 0);
      });
    }
    /** Picks a run up after a page load: the same step, beat and position, the journal intact. */
    resume(state) {
      if (this.run && this.run.base !== "done") return;
      const tour = this.deps.tour;
      if (state.tourId !== tour.id) return;
      const s = { ...state, doc: this.deps.doc ?? state.doc + 1, at: { ...state.at } };
      s.stepIndex = Math.min(s.stepIndex, tour.steps.length - 1);
      this.run = this.newRun(s);
      if (s.paused) this.run.clocks.pace.pause();
      this.launch(async (signal) => {
        const r = this.must();
        r.base = "starting";
        r.phase = "start";
        this.publish();
        if (s.target !== null && s.stepIndex < s.target) {
          await this.prepareFrom(signal, s.target);
          return;
        }
        await this.step(signal, s.stepIndex, s.beatIndex, s.at, true);
      });
    }
    newRun(state) {
      const clocks = this.deps.clocks(state.speed);
      const stamp = () => {
        const r = this.run;
        if (!r) return { seq: 0, doc: state.doc };
        r.state.seq += 1;
        return { seq: r.state.seq, doc: r.state.doc };
      };
      const run = {
        state,
        journal: new Set(state.journal),
        clocks,
        executor: this.deps.executor({
          clocks,
          onPhase: (action, phase, input) => this.film({ type: "action", id: action.id, kind: action.kind, phase, ...input ? { input } : {} }),
          onCamera: (frame) => this.camera(frame),
          onNote: (note) => {
            this.run?.notes.push(note);
          }
        }),
        timeline: state.mode === "film" && this.deps.timeline ? this.deps.timeline(stamp) : NO_TIMELINE,
        base: "idle",
        phase: "start",
        resumed: /* @__PURE__ */ new Set(),
        blocked: null,
        caption: null,
        ended: null,
        notes: [],
        beatId: null,
        framing: false,
        again: null
      };
      return run;
    }
    // ——— Commands ———
    dispatch = (command2) => {
      const r = this.run;
      if (!r) return;
      const over = r.base === "done" || r.base === "ending";
      switch (command2.type) {
        case "pause":
          if (r.state.mode === "watch" && !over) this.pause();
          return;
        case "resume":
          if (r.state.mode === "watch" && !over) this.unpause();
          return;
        case "go":
          this.go?.();
          return;
        case "mute":
          this.deps.audio?.setMuted(command2.muted ?? !this.deps.audio.muted);
          this.publish();
          return;
        case "end":
          if (!over) this.launch((s) => this.finish(s, "left"));
          return;
        default:
          break;
      }
      if (over || r.base === "starting") return;
      switch (command2.type) {
        case "next":
          this.launch((s) => this.jump(s, r.state.stepIndex + 1));
          return;
        case "back":
          this.launch((s) => this.jump(s, Math.max(0, r.state.stepIndex - 1)));
          return;
        case "jump":
          if (command2.stepIndex >= 0 && command2.stepIndex < this.deps.tour.steps.length) this.launch((s) => this.jump(s, command2.stepIndex));
          return;
        case "retry":
          if (r.base === "blocked") this.recover("retry");
          return;
        case "skip":
          if (r.base === "blocked") this.recover("skip");
          return;
      }
    };
    go = null;
    // ——— Flows ———
    /** Aborts the flow in hand, waits for it to settle, then runs this one. */
    launch(flow) {
      this.flow?.abort();
      const mine = new AbortController();
      this.flow = mine;
      const before = this.settled;
      this.settled = (async () => {
        await before;
        if (mine.signal.aborted) return;
        this.deps.audio?.stop();
        try {
          await flow(mine.signal);
        } catch (e) {
          if (isAborted(e) || mine.signal.aborted) return;
          this.block(e);
        }
      })();
    }
    /** Enters a step (unless resuming inside one) and plays from there. */
    async step(signal, index, beat = 0, from, resumed = false) {
      const r = this.must();
      if (!from || !r.state.entered) await this.enter(signal, index, beat, from);
      if (r.state.mode === "film" && !r.state.rolling) await this.arm(signal);
      await this.play(signal, index, beat, from, resumed);
    }
    async enter(signal, index, beat, from) {
      const r = this.must();
      const step = this.stepAt(index);
      r.state.stepIndex = index;
      r.state.beatIndex = beat;
      r.state.at = from ? { ...from } : fresh();
      r.base = "entering";
      r.phase = "enter";
      r.blocked = null;
      r.caption = null;
      this.persist();
      this.publish();
      await this.arrive(signal, step);
    }
    /** Clears what the last step left, goes to the step's screen and waits for it. */
    async arrive(signal, step) {
      const r = this.must();
      r.state.entered = false;
      this.persist();
      r.executor.clear();
      if (step.path) await this.deps.navigate(step.path, signal);
      throwIfAborted(signal);
      if (step.ready) await this.wait(step.ready, signal);
      r.state.entered = true;
      this.persist();
    }
    wait(ready, signal) {
      const r = this.must();
      return this.deps.waitFor(ready, { clock: r.clocks.wall, signal, timeoutMs: r.state.mode === "film" && r.state.rolling ? FILM_WAIT_MS : READY_TIMEOUT_MS });
    }
    /** Film: ready, and waiting for the host to roll. */
    async arm(signal) {
      const r = this.must();
      r.base = "armed";
      this.publish();
      await this.deps.filmReady?.(signal);
      throwIfAborted(signal);
      let rolling;
      if (this.deps.waitGo) rolling = this.deps.waitGo();
      else {
        rolling = new Promise((resolve2) => {
          this.go = resolve2;
        });
      }
      const tour = this.deps.tour;
      this.film({
        type: "film:armed",
        tour: tour.id,
        fingerprint: narrationFingerprint(narrationLines(tour)),
        manifestId: this.deps.manifest?.id ?? null,
        viewport: this.deps.viewport?.() ?? { w: 0, h: 0, dpr: 1 },
        runtime: this.deps.runtimeVersion ?? "0"
      });
      await Promise.race([rolling, whenAborted(signal)]);
      this.go = null;
      await this.deps.frame?.();
      await this.deps.frame?.();
      throwIfAborted(signal);
      r.state.rolling = true;
      this.persist();
      this.film({ type: "film:start" });
    }
    /** Plays from a beat of a step to the tour's end. */
    async play(signal, index, beat, from, resumed = false) {
      const r = this.must();
      const tour = this.deps.tour;
      let resume = from;
      let first = resumed;
      for (let s = index; s < tour.steps.length; s++) {
        if (s !== index) await this.enter(signal, s, 0);
        const step = this.stepAt(s);
        for (let b = s === index ? beat : 0; b < step.beats.length; b++) {
          const bt = step.beats[b];
          r.state.beatIndex = b;
          r.state.at = resume ? { ...resume } : fresh();
          r.base = "playing";
          r.phase = "beat";
          this.persist();
          this.publish();
          await this.unpaused(signal);
          await this.playBeat(signal, step, bt, first);
          resume = void 0;
          first = false;
        }
        r.state.beatIndex = step.beats.length;
      }
      await this.finish(signal, "finished");
    }
    async playBeat(signal, step, beat, resumed) {
      const r = this.must();
      const { pace, wall } = r.clocks;
      const at = r.state.at;
      const began = wall.now();
      const actions = beat.actions ?? [];
      const nav = actions.length > 0 && actions[actions.length - 1]?.navigates ? actions.length - 1 : -1;
      const cues = schedule(beat, { tour: this.deps.tour.id, ...this.deps.manifest !== void 0 ? { manifest: this.deps.manifest } : {} });
      const overlay = this.deps.overlay ?? NO_OVERLAY;
      const navDispatched = resumed && at.stage === "nav";
      if (at.stage === "begin") {
        if (beat.card) overlay.card({ title: beat.card.title, lines: beat.card.lines ?? [] });
        this.beatStart(step, beat);
        at.stage = "tracks";
        this.persist();
      } else {
        r.beatId = beat.id;
        if (beat.card) overlay.card({ title: beat.card.title, lines: beat.card.lines ?? [] });
      }
      if (at.speaking !== null) {
        this.film({ type: "sentence:end", beat: beat.id, index: at.speaking });
        at.sentence = at.speaking + 1;
        at.speaking = null;
        this.persist();
      }
      const firstSentence = at.sentence;
      if (at.stage === "tracks") {
        const both = new AbortController();
        const stop = () => both.abort();
        signal.addEventListener("abort", stop, { once: true });
        const gates = /* @__PURE__ */ new Map();
        const gate = (id) => {
          let g = gates.get(id);
          if (!g) {
            let open = () => {
            };
            const promise = new Promise((resolve2) => {
              open = resolve2;
            });
            g = { promise, open };
            gates.set(id, g);
          }
          return g;
        };
        for (const a of actions.slice(0, at.action)) gate(a.id).open();
        if (nav >= 0 && at.action > nav) gate(actions[nav].id).open();
        const narration = (async () => {
          for (const cue of cues.slice(at.sentence)) {
            await this.unpaused(both.signal);
            const next = cues[cue.index + 1];
            if (next && r.state.mode !== "film") this.deps.audio?.preload(next);
            await speak([cue], {
              clock: pace,
              signal: both.signal,
              audio: r.state.mode === "film" ? null : this.deps.audio ?? null,
              gate: (id) => Promise.race([gate(id).promise, whenAborted(both.signal)]),
              onStart: (c) => this.sentenceStart(c),
              onEnd: (c) => this.sentenceEnd(c)
            });
            at.sentence = cue.index + 1;
            this.persist();
          }
        })();
        const upTo = nav >= 0 ? nav - 1 : actions.length - 1;
        const acting = this.act(both.signal, step, beat, at.action, false, (a) => gate(a.id).open(), upTo);
        try {
          const results = await Promise.allSettled([
            narration.catch((e) => {
              both.abort();
              throw e;
            }),
            acting.catch((e) => {
              both.abort();
              throw e;
            })
          ]);
          throwIfAborted(signal);
          const failed = results.filter((x) => x.status === "rejected").map((x) => x.reason);
          const cause = failed.find((e) => !isAborted(e)) ?? failed[0];
          if (cause !== void 0) throw cause;
        } finally {
          signal.removeEventListener("abort", stop);
        }
        at.stage = nav >= 0 ? "nav" : "ready";
        at.action = nav >= 0 ? nav : actions.length;
        this.persist();
        if (nav >= 0) await this.checkpoint(signal, step, beat);
      }
      if (at.stage === "nav" && nav >= 0) {
        const action = actions[nav];
        at.action = nav;
        if (navDispatched) {
          const key = journalKey(step.id, beat.id, action.id);
          if (action.done && !r.journal.has(key)) await this.wait(action.done, signal);
          if (action.effect === "write") this.journalOf(r).add(key);
          this.film({ type: "action", id: action.id, kind: action.kind, phase: "done" });
        } else {
          this.persist();
          await this.act(signal, step, beat, nav, false, void 0, nav);
        }
        at.stage = "ready";
        at.action = actions.length;
        this.persist();
      }
      if (at.stage === "ready") {
        r.phase = "ready";
        if (beat.ready) await this.wait(beat.ready, signal);
        at.stage = "dwell";
        this.persist();
        if (nav < 0) await this.checkpoint(signal, step, beat);
      }
      const waitedMs = Math.max(0, wall.now() - began);
      await pace.sleep(beat.dwellMs ?? DEFAULT_DWELL_MS, signal);
      this.beatEnd(beat, cuesMs(cues.slice(firstSentence)), waitedMs);
      if (beat.card) overlay.card(null);
    }
    /**
     * A beat's actions, in order. What a write this run has already made needed before it (opening
     * the form, typing the reason) is left out, so re-showing a step opens nothing it won't finish.
     * Only the journal says so: a `done` that happens to hold before the write (an absence) doesn't.
     */
    async act(signal, step, beat, from, instant, done = () => {
    }, upTo) {
      const r = this.must();
      const actions = beat.actions ?? [];
      const last = upTo ?? actions.length - 1;
      const journal = this.journalOf(r);
      const key = (a) => journalKey(step.id, beat.id, a.id);
      let settledTo = -1;
      actions.forEach((a, i) => {
        if (a.effect === "write" && i >= from && journal.has(key(a))) settledTo = i;
      });
      for (let i = from; i <= last && i < actions.length; i++) {
        const action = actions[i];
        r.state.at.action = i;
        if (!instant) {
          await this.unpaused(signal);
          this.persist();
        }
        throwIfAborted(signal);
        const prepares = i < settledTo && (action.effect ?? "read") === "read" && !isCosmetic(action);
        if (!prepares) {
          await r.executor.runAction(action, {
            instant,
            signal,
            journal,
            key: key(action),
            ...r.state.mode === "film" && r.state.rolling ? { maxWaitMs: FILM_WAIT_MS } : {}
          });
        }
        done(action);
      }
      r.state.at.action = Math.min(last + 1, actions.length);
    }
    journalOf(r) {
      return {
        has: (k) => r.journal.has(k),
        add: (k) => {
          if (r.journal.has(k)) return;
          r.journal.add(k);
          r.state.journal = [...r.journal];
          this.persist();
        }
      };
    }
    // ——— Next, Back, fast-forward ———
    /** Goes to a step. Forwards, the writes on the way are made at once; backwards, nothing is written. */
    async jump(signal, target) {
      const r = this.must();
      const last = this.deps.tour.steps.length - 1;
      if (target > r.state.stepIndex) {
        r.blocked = null;
        await this.finishStep(signal);
        if (target > last) {
          await this.finish(signal, "finished");
          return;
        }
        if (target > r.state.stepIndex + 1) await this.prepare(signal, r.state.stepIndex + 1, target);
      }
      await this.step(signal, Math.min(target, last));
    }
    /** What is left of the current step, at once: up to its last write still to make. */
    async finishStep(signal) {
      const r = this.must();
      const step = this.stepAt(r.state.stepIndex);
      if (!r.state.entered && this.owes(r, step, r.state.beatIndex, r.state.at.action)) {
        r.phase = "enter";
        await this.arrive(signal, step);
      }
      r.phase = "beat";
      await this.writes(signal, step, r.state.beatIndex, r.state.at.action);
      r.state.beatIndex = step.beats.length;
      r.state.at = fresh();
    }
    /** The writes of steps `from` to `to − 1`, silently. */
    async prepare(signal, from, to) {
      const r = this.must();
      r.base = "entering";
      r.phase = "prepare";
      r.state.target = to;
      r.caption = null;
      this.persist();
      this.publish();
      for (let s = from; s < to; s++) {
        const step = this.stepAt(s);
        if (!this.owes(r, step, 0, 0)) continue;
        r.state.stepIndex = s;
        r.state.beatIndex = 0;
        r.state.at = fresh();
        this.persist();
        await this.arrive(signal, step);
        await this.writes(signal, step, 0, 0);
      }
      r.state.target = null;
      this.persist();
    }
    /** A fast-forward a page load interrupted: picked up at the step it was on. */
    async prepareFrom(signal, target) {
      const r = this.must();
      const s = r.state.stepIndex;
      const step = this.stepAt(s);
      r.base = "entering";
      r.phase = "prepare";
      this.publish();
      if (!r.state.entered) await this.arrive(signal, step);
      await this.writes(signal, step, r.state.beatIndex, r.state.at.action);
      if (s + 1 < target) await this.prepare(signal, s + 1, target);
      r.state.target = null;
      this.persist();
      await this.step(signal, target);
    }
    /** Where the step's last write not yet in the journal is, from a position on; null for none. */
    lastOwed(r, step, beat, action) {
      let last = null;
      for (let b = beat; b < step.beats.length; b++) {
        const actions = step.beats[b]?.actions ?? [];
        for (let a = b === beat ? action : 0; a < actions.length; a++) {
          const x = actions[a];
          if (x.effect !== "write") continue;
          if (!r.journal.has(journalKey(step.id, step.beats[b].id, x.id))) last = { beat: b, action: a };
        }
      }
      return last;
    }
    owes(r, step, beat, action) {
      return this.lastOwed(r, step, beat, action) !== null;
    }
    /** Makes the step's remaining writes at once, with what they need before them. */
    async writes(signal, step, beat, action) {
      const r = this.must();
      const last = this.lastOwed(r, step, beat, action);
      if (!last) return;
      for (let b = beat; b <= last.beat; b++) {
        const at = step.beats[b];
        r.state.beatIndex = b;
        const from = b === beat ? action : 0;
        const upTo = b === last.beat ? last.action : (at.actions?.length ?? 0) - 1;
        this.persist();
        await this.act(signal, step, at, from, true, void 0, upTo);
        if (b < last.beat && at.ready) await this.wait(at.ready, signal);
      }
    }
    // ——— The end, pause, blocked ———
    async finish(signal, reason) {
      const r = this.must();
      r.base = "ending";
      r.phase = "finish";
      r.blocked = null;
      r.caption = null;
      r.state.paused = false;
      r.clocks.pace.resume();
      this.publish();
      if (r.state.mode === "film" && r.state.rolling && reason !== "error") this.film({ type: "film:end" });
      r.executor.clear();
      this.deps.audio?.stop();
      (this.deps.overlay ?? NO_OVERLAY).caption(null);
      this.deps.store.clear();
      if (signal.aborted) return;
      r.base = "done";
      r.ended = { reason };
      this.publish();
    }
    pause() {
      const r = this.must();
      if (r.state.paused) return;
      r.state.paused = true;
      r.clocks.pace.pause();
      this.deps.audio?.pause();
      this.persist();
      this.publish();
    }
    unpause() {
      const r = this.must();
      if (!r.state.paused) return;
      r.state.paused = false;
      r.clocks.pace.resume();
      this.deps.audio?.resume();
      for (const wake of [...r.resumed]) wake();
      r.resumed.clear();
      this.persist();
      this.publish();
    }
    /** Holds a Watch tour while it is paused. */
    unpaused(signal) {
      const r = this.must();
      if (!r.state.paused) return Promise.resolve();
      this.publish();
      return new Promise((resolve2, reject) => {
        const wake = () => {
          signal.removeEventListener("abort", stop);
          resolve2();
        };
        const stop = () => {
          r.resumed.delete(wake);
          reject(new Aborted());
        };
        if (signal.aborted) {
          reject(new Aborted());
          return;
        }
        r.resumed.add(wake);
        signal.addEventListener("abort", stop, { once: true });
      });
    }
    block(e) {
      const r = this.run;
      if (!r) return;
      const message = e instanceof Error ? e.message : String(e);
      const what = e instanceof ActionError ? e.anchor ? "anchor" : "error" : /Still waiting|Couldn't find/.test(message) ? "ready" : "error";
      const step = this.deps.tour.steps[r.state.stepIndex];
      const inBeat = r.phase === "beat" || r.phase === "prepare";
      const action = e instanceof ActionError ? e.action.label ?? e.action.id : inBeat ? step?.beats[r.state.beatIndex]?.actions?.[r.state.at.action]?.label ?? null : null;
      const anchor = e instanceof ActionError ? e.anchor : null;
      r.blocked = { what, message, action, anchor };
      r.base = "blocked";
      r.caption = null;
      if (r.state.mode === "film") {
        const beat = r.beatId ?? step?.beats[r.state.beatIndex]?.id;
        this.film({ type: "film:error", ...beat ? { beat } : {}, message, ...anchor ? { anchor } : {} });
        r.beatId = null;
        r.base = "done";
        r.ended = { reason: "error" };
        this.deps.store.clear();
      }
      this.publish();
    }
    recover(how) {
      const r = this.must();
      const step = this.stepAt(r.state.stepIndex);
      const beat = step.beats[r.state.beatIndex];
      const at = { ...r.state.at };
      const skip = how === "skip";
      r.blocked = null;
      switch (r.phase) {
        case "start":
          this.launch((s) => this.step(s, r.state.stepIndex, r.state.beatIndex));
          return;
        case "prepare":
          this.launch(async (s) => {
            if (skip) {
              r.state.stepIndex += 1;
              r.state.beatIndex = 0;
              r.state.at = fresh();
              r.state.entered = false;
            }
            await this.prepareFrom(s, r.state.target ?? r.state.stepIndex);
          });
          return;
        case "enter":
          this.launch((s) => skip ? this.step(s, r.state.stepIndex, r.state.beatIndex, fresh()) : this.step(s, r.state.stepIndex, r.state.beatIndex));
          return;
        case "beat":
          this.launch((s) => this.step(s, r.state.stepIndex, r.state.beatIndex, { ...at, action: skip ? at.action + 1 : at.action }));
          return;
        case "ready":
          this.launch((s) => skip ? this.after(s) : this.step(s, r.state.stepIndex, r.state.beatIndex, { ...at, stage: "ready", action: beat?.actions?.length ?? 0, sentence: beat?.narration?.length ?? 0 }));
          return;
        case "finish":
          this.launch((s) => this.finish(s, "left"));
          return;
      }
    }
    /** Skipping a beat's readiness: on to the next beat. */
    async after(signal) {
      const r = this.must();
      const step = this.stepAt(r.state.stepIndex);
      if (r.state.beatIndex + 1 < step.beats.length) await this.play(signal, r.state.stepIndex, r.state.beatIndex + 1, fresh());
      else if (r.state.stepIndex + 1 < this.deps.tour.steps.length) await this.step(signal, r.state.stepIndex + 1);
      else await this.finish(signal, "finished");
    }
    // ——— The film's events, captions, the state ———
    film(event) {
      const r = this.run;
      if (!r || r.state.mode !== "film") return;
      if (event.type === "action") {
        if (!r.beatId || !r.state.rolling) return;
        r.timeline.emit({ ...event, beat: r.beatId });
      } else r.timeline.emit(event);
      this.persist();
    }
    /** Rehearse: the beat's still and checks, before it dwells (or before it leaves the page). */
    async checkpoint(signal, step, beat) {
      const r = this.must();
      if (!this.deps.checkpoint) return;
      await this.deps.checkpoint({ stepIndex: r.state.stepIndex, beatIndex: r.state.beatIndex, step, beat });
      throwIfAborted(signal);
    }
    beatStart(step, beat) {
      const r = this.must();
      r.beatId = beat.id;
      this.film({
        type: "beat:start",
        beat: beat.id,
        index: r.state.filmBeats,
        step: step.id,
        kind: beat.card ? "card" : "screen",
        ...beat.card?.title ?? step.title ? { title: beat.card?.title ?? step.title } : {}
      });
    }
    beatEnd(beat, narration, waitedMs) {
      const r = this.must();
      this.camera(null);
      this.film({ type: "beat:end", beat: beat.id, index: r.state.filmBeats, narrationMs: narration, waitedMs });
      r.state.filmBeats += 1;
      r.beatId = null;
      this.persist();
    }
    /** Film: where the camera frames (recorded in v1, used from v1.1). Outside a filmed beat, nothing. */
    camera(frame) {
      const r = this.run;
      if (!r || r.state.mode !== "film" || !r.state.rolling || !r.beatId) return;
      if (!frame || !frame.rect) {
        if (!r.framing) return;
        r.framing = false;
        r.timeline.emit({ type: "camera", beat: r.beatId, rect: null, scale: 1, easeMs: frame?.easeMs ?? 0 });
        return;
      }
      r.framing = true;
      r.timeline.emit({ type: "camera", beat: r.beatId, rect: frame.rect, scale: frame.scale, easeMs: frame.easeMs });
    }
    sentenceStart(cue) {
      const r = this.must();
      r.caption = { beat: cue.beat, index: cue.index, text: cue.text };
      r.state.at.speaking = cue.index;
      this.persist();
      (this.deps.overlay ?? NO_OVERLAY).caption(cue.text);
      this.film({ type: "sentence:start", beat: cue.beat, index: cue.index, text: cue.text, audio: cue.audio ? { hash: cue.audio.hash, durationMs: cue.audio.durationMs } : null });
      this.publish();
    }
    sentenceEnd(cue) {
      const r = this.run;
      if (!r) return;
      r.state.at.speaking = null;
      this.film({ type: "sentence:end", beat: cue.beat, index: cue.index });
      (this.deps.overlay ?? NO_OVERLAY).caption(null);
      if (r.caption?.beat === cue.beat && r.caption.index === cue.index) r.caption = null;
      this.persist();
      this.publish();
    }
    stepAt(index) {
      const step = this.deps.tour.steps[index];
      if (!step) throw new Error(`no step ${index}`);
      return step;
    }
    must() {
      if (!this.run) throw new Error("No tour is running");
      return this.run;
    }
    publish() {
      this.deps.publish?.(this.snapshot);
    }
    persist() {
      const r = this.run;
      if (!r || r.base === "done" || r.base === "ending") return;
      const overlay = this.deps.overlay ?? NO_OVERLAY;
      r.state.pointer = overlay.pointer();
      r.state.journal = [...r.journal];
      this.deps.store.save({ ...r.state, at: { ...r.state.at } });
    }
  };

  // toolkit/runtime/src/film-aids.ts
  var ROLLING_KEY = "__showcaseRolling";
  var PROBE_TAG = "showcase-probe";
  var HEARTBEAT_TAG = "showcase-heartbeat";
  var PROBE_COLOUR = "#ff00ff";
  var STALL_MS = 50;
  function fixed(el, css) {
    Object.assign(el.style, { position: "fixed", pointerEvents: "none", zIndex: "2147483647", margin: "0", padding: "0", border: "0" }, css);
  }
  function createFilmAids(win, n) {
    const doc = win.document;
    let beat = null;
    const attach = (el) => {
      if (el.isConnected) return true;
      const root = doc.documentElement;
      if (!root) return false;
      root.appendChild(el);
      return true;
    };
    const tick = () => {
      const b = beat;
      if (!b) return;
      const now = n.perfNow();
      if (b.frames > 0 && now - b.last > STALL_MS && b.stalls.length < 100) b.stalls.push({ wall: n.dateNow(), ms: Math.round(now - b.last) });
      b.last = now;
      if (attach(b.el)) {
        b.flip = !b.flip;
        b.el.style.opacity = b.flip ? "0.01" : "0";
        b.frames += 1;
      }
      b.frame = n.requestAnimationFrame(tick);
    };
    return {
      probe(holdMs = 200) {
        return new Promise((resolve2) => {
          const el = doc.createElement(PROBE_TAG);
          fixed(el, { inset: "0", width: "100vw", height: "100vh", background: PROBE_COLOUR, display: "block" });
          n.requestAnimationFrame(() => {
            attach(el);
            const wall = n.dateNow();
            n.setTimeout(() => {
              el.remove();
              resolve2({ wall });
            }, holdMs);
          });
        });
      },
      heartbeat(on) {
        if (on && !beat) {
          const el = doc.createElement(HEARTBEAT_TAG);
          fixed(el, { right: "0", bottom: "0", width: "1px", height: "1px", background: "#000", opacity: "0", display: "block" });
          beat = { el, frame: 0, frames: 0, since: n.perfNow(), flip: false, last: n.perfNow(), stalls: [] };
          beat.frame = n.requestAnimationFrame(tick);
        } else if (!on && beat) {
          n.cancelAnimationFrame(beat.frame);
          beat.el.remove();
          beat = null;
        }
      },
      frameRate: () => beat ? { frames: beat.frames, ms: n.perfNow() - beat.since, stalls: [...beat.stalls] } : { frames: 0, ms: 0, stalls: [] }
    };
  }

  // toolkit/runtime/src/inspect.ts
  var OUTLINE_ROLES = /* @__PURE__ */ new Set([
    "button",
    "link",
    "textbox",
    "searchbox",
    "checkbox",
    "radio",
    "combobox",
    "listbox",
    "switch",
    "slider",
    "spinbutton",
    "menuitem",
    "menuitemcheckbox",
    "menuitemradio",
    "tab",
    "option",
    "heading",
    "dialog",
    "alertdialog",
    "region",
    "navigation",
    "main",
    "form",
    "search",
    "banner",
    "contentinfo",
    "complementary",
    "img",
    "figure",
    "table",
    "status",
    "alert",
    "progressbar",
    "listitem",
    "tabpanel",
    "menu",
    "toolbar",
    "grid",
    "row",
    "cell"
  ]);
  var NEED_NAME = /* @__PURE__ */ new Set(["region", "form", "listitem", "row", "cell", "img", "figure", "table", "menu", "toolbar", "tabpanel", "grid"]);
  function cssPath(el) {
    if (el.id && /^[A-Za-z][\w-]*$/.test(el.id)) return `#${el.id}`;
    const tag = el.tagName.toLowerCase();
    const name = el.getAttribute("name");
    if (name && /^[\w-]+$/.test(name)) return `${tag}[name="${name}"]`;
    const cls = [...el.classList].filter((c) => /^[A-Za-z][\w-]*$/.test(c)).slice(0, 2);
    if (cls.length) return `${tag}.${cls.join(".")}`;
    return null;
  }
  function testIdOf(el) {
    return el.getAttribute("data-testid") ?? el.getAttribute("data-test-id") ?? el.getAttribute("data-test");
  }
  function labelText(el) {
    const tag = el.tagName;
    if (tag !== "INPUT" && tag !== "SELECT" && tag !== "TEXTAREA") return null;
    const labels = el.labels;
    const first = labels?.[0];
    return first ? squash(first.textContent) || null : null;
  }
  function suggestAnchor(el, ctx, frame) {
    const role = roleOf(el);
    const name = squash(accessibleName(el, role));
    const withFrame = (a) => frame ? { ...a, frame } : a;
    const finds = (a) => {
      try {
        return resolve(a, ctx) === el;
      } catch {
        return false;
      }
    };
    const tries = [];
    if (role && name) {
      tries.push({ a: withFrame({ role, name }), by: "role" });
      tries.push({ a: withFrame({ role, name, exact: true }), by: "role" });
    }
    const label = labelText(el);
    if (label) tries.push({ a: withFrame({ label }), by: "label" });
    const tid = testIdOf(el);
    if (tid) tries.push({ a: withFrame({ testId: tid }), by: "testId" });
    const text = squash(el.innerText ?? el.textContent);
    if (text && text.length <= 60) tries.push({ a: withFrame({ text }), by: "text" });
    const css = cssPath(el);
    if (css) tries.push({ a: withFrame({ css }), by: "css" });
    for (const t of tries) if (finds(t.a)) return { anchor: t.a, by: t.by };
    if (role && name) {
      for (let nth = 1; nth < 20; nth++) {
        const a = withFrame({ role, name, exact: true, nth });
        if (finds(a)) return { anchor: a, by: "role" };
      }
    }
    return null;
  }
  function outline(doc, options = {}) {
    const limit = options.limit ?? 400;
    const ctx = { document: doc, anchors: {} };
    const items = [];
    const frames = /* @__PURE__ */ new Map();
    frames.set(doc, null);
    for (const d of documentsOf(doc)) {
      if (d === doc) continue;
      const frameEl = d.defaultView?.frameElement;
      const sel = frameEl ? frameEl.id ? `#${frameEl.id}` : frameEl.getAttribute("title") ? `iframe[title="${frameEl.getAttribute("title")}"]` : "iframe" : "iframe";
      frames.set(d, sel);
    }
    for (const [d, frame] of frames) {
      const stack = [];
      for (const el of queryDeep(d, "*")) {
        if (items.length >= limit) return items;
        if (el.closest("showcase-overlay, showcase-controls")) continue;
        const role = roleOf(el);
        if (!role || !OUTLINE_ROLES.has(role)) continue;
        const visible = isVisible(el);
        if (!visible && !options.hidden) continue;
        const name = squash(accessibleName(el, role));
        if (!name && NEED_NAME.has(role)) continue;
        while (stack.length && !stack[stack.length - 1]?.contains(el)) stack.pop();
        const s = suggestAnchor(el, ctx, frame);
        const item = { role, name, depth: stack.length, visible, frame, anchor: s?.anchor ?? null, by: s?.by ?? null };
        if (role === "heading") {
          const m = /^H([1-6])$/.exec(el.tagName);
          const level = Number(el.getAttribute("aria-level") ?? (m ? m[1] : 2));
          if (Number.isFinite(level)) item.level = level;
        }
        items.push(item);
        stack.push(el);
      }
    }
    return items;
  }
  function visibleText(doc) {
    const parts = [];
    for (const d of documentsOf(doc)) {
      const body = d.body;
      if (body) parts.push(body.innerText ?? body.textContent ?? "");
      for (const el of queryDeep(d, "input, textarea, select")) {
        if (!isVisible(el) || el.closest("showcase-overlay, showcase-controls")) continue;
        const type = (el.getAttribute("type") ?? "").toLowerCase();
        if (type === "password" || type === "hidden") continue;
        if (el.tagName === "SELECT") {
          const s = el;
          parts.push(s.selectedOptions[0]?.text ?? "");
        } else parts.push(el.value ?? "");
      }
    }
    return parts.filter(Boolean).join("\n");
  }

  // toolkit/runtime/src/overlay/place.ts
  var CALLOUT_GAP = 12;
  var clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));
  function placeCallout(target, size, frame, gap = CALLOUT_GAP) {
    const minX = gap;
    const maxX = frame.w - size.w - gap;
    const minY = frame.top + gap;
    const maxY = frame.h - frame.bottom - size.h - gap;
    const centreX = clamp(target.x + target.w / 2 - size.w / 2, minX, maxX);
    const centreY = clamp(target.y + target.h / 2 - size.h / 2, minY, maxY);
    const below = target.y + target.h + gap;
    if (below + size.h <= frame.h - frame.bottom - gap) return { x: centreX, y: below, side: "below" };
    const above = target.y - gap - size.h;
    if (above >= minY) return { x: centreX, y: above, side: "above" };
    const right = target.x + target.w + gap;
    if (right + size.w <= frame.w - gap) return { x: right, y: centreY, side: "right" };
    const left = target.x - gap - size.w;
    if (left >= minX) return { x: left, y: centreY, side: "left" };
    return { x: clamp(target.x + gap, minX, maxX), y: clamp(target.y + gap, minY, maxY), side: "inside" };
  }

  // toolkit/runtime/src/overlay/styles.ts
  var FONT_FAMILY = "Showcase UI";
  var FONT_CSS = `
@font-face { font-family: "${FONT_FAMILY}"; font-weight: 400; src: local("Inter"), local("Inter Regular"), local("SF Pro Text"), local("Helvetica Neue"), local("Segoe UI"), local("Roboto"), local("Arial"); }
@font-face { font-family: "${FONT_FAMILY}"; font-weight: 600; src: local("Inter SemiBold"), local("Inter Semi Bold"), local("SF Pro Text Semibold"), local("HelveticaNeue-Medium"), local("Segoe UI Semibold"), local("Roboto Medium"), local("Arial Bold"); }
`;
  var FONT = `"${FONT_FAMILY}", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
  var OVERLAY_CSS = `
:host { all: initial; position: fixed; inset: 0; width: 100vw; height: 100vh; max-width: none; max-height: none;
  margin: 0; padding: 0; border: 0; background: transparent; overflow: visible; pointer-events: none;
  z-index: 2147483647; display: block; font-family: ${FONT}; color-scheme: light; }
:host::backdrop { display: none; }
.layer { position: absolute; inset: 0; pointer-events: none; }
[hidden] { display: none !important; }

.card, .end { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 28px; padding: 6vh 8vw; box-sizing: border-box; text-align: center; color: #f8fafc;
  background: radial-gradient(120% 120% at 20% 10%, #1e3a8a 0%, #0f172a 55%, #020617 100%); }
.card h1, .end h1 { margin: 0; font: 600 clamp(32px, 5.2vh, 64px)/1.15 ${FONT}; letter-spacing: -0.01em; max-width: 22ch; text-wrap: balance; }
.card ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 12px; }
.card li { font: 400 clamp(20px, 2.8vh, 34px)/1.3 ${FONT}; color: #cbd5e1; }
.end p { margin: 0; font: 400 clamp(16px, 2.2vh, 24px)/1.4 ${FONT}; color: #cbd5e1; }
.end .kicker { font: 600 14px/1 ${FONT}; letter-spacing: 0.24em; text-transform: uppercase; color: #93c5fd; }

.spot { position: absolute; left: 0; top: 0; width: 0; height: 0; border-radius: 10px;
  box-shadow: 0 0 0 200vmax rgb(2 6 23 / 0.5); outline: 3px solid rgb(255 255 255 / 0.95); outline-offset: 1px;
  transition: left 180ms ease-out, top 180ms ease-out, width 180ms ease-out, height 180ms ease-out; }
.callout { position: absolute; left: 0; top: 0; box-sizing: border-box; max-width: min(340px, 80vw); padding: 12px 16px;
  border-radius: 12px; background: #ffffff; color: #0f172a; box-shadow: 0 10px 30px rgb(2 6 23 / 0.35);
  border-left: 4px solid #2563eb; }
.callout h2 { margin: 0 0 4px; font: 600 17px/1.3 ${FONT}; }
.callout p { margin: 0; font: 400 15px/1.45 ${FONT}; color: #334155; }

.pointer { position: absolute; left: 0; top: 0; width: 30px; height: 30px; will-change: transform;
  filter: drop-shadow(0 2px 3px rgb(0 0 0 / 0.45)); }
.pointer svg { display: block; width: 30px; height: 30px; overflow: visible; }
.ripple { position: absolute; left: 0; top: 0; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%;
  border: 3px solid #2563eb; box-sizing: border-box; opacity: 0; }

.captions { position: absolute; left: 0; right: 0; bottom: 92px; display: flex; justify-content: center; padding: 0 24px; }
:host([data-controls="off"]) .captions { bottom: 36px; }
.caption { margin: 0; box-sizing: border-box; max-width: min(92vw, calc(42ch + 1.6em)); padding: 0.32em 0.8em;
  border-radius: 10px; background: rgb(15 23 42 / 0.92); color: #ffffff; text-align: center; text-wrap: balance;
  font: 600 clamp(18px, 2.6vh, 30px)/1.35 ${FONT}; font-variant-numeric: tabular-nums; box-shadow: 0 6px 20px rgb(0 0 0 / 0.3); }

:host([data-motion="reduce"]) .spot, :host([data-motion="none"]) .spot { transition: none; }
`;
  var CONTROLS_CSS = `
:host { all: initial; position: fixed; left: 50%; bottom: 22px; transform: translateX(-50%); z-index: 2147483647;
  display: block; pointer-events: auto; font-family: ${FONT}; color-scheme: light; margin: 0; padding: 0; }
:host([data-acting]) { pointer-events: none; }
:host([data-acting]) .bar { pointer-events: none; }
[hidden] { display: none !important; }
.bar { display: flex; align-items: center; gap: 2px; padding: 6px; border-radius: 999px; background: rgb(15 23 42 / 0.94);
  color: #f8fafc; box-shadow: 0 8px 24px rgb(2 6 23 / 0.4); user-select: none; -webkit-user-select: none; }
button { all: unset; box-sizing: border-box; width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center;
  cursor: pointer; color: inherit; }
button:hover { background: rgb(255 255 255 / 0.14); }
button svg { width: 20px; height: 20px; fill: currentColor; }
button.text { width: auto; padding: 0 14px; border-radius: 999px; font: 600 14px/1 ${FONT}; }
.label { padding: 0 10px; font: 600 13px/1 ${FONT}; color: #cbd5e1; font-variant-numeric: tabular-nums; white-space: nowrap; }
.stuck { max-width: 36ch; padding: 0 10px; font: 400 13px/1.3 ${FONT}; color: #fecaca; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sep { width: 1px; height: 22px; margin: 0 4px; background: rgb(255 255 255 / 0.2); }
`;

  // toolkit/runtime/src/overlay/top-layer.ts
  var GUARDED = ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "dblclick", "auxclick", "contextmenu", "focusin", "focusout", "touchstart", "touchend", "wheel"];
  var KEY2 = "__showcaseTopLayer";
  function installTopLayer(win) {
    const w = win;
    const held = w[KEY2];
    if (held) return held;
    const listeners = /* @__PURE__ */ new Set();
    const owned = /* @__PURE__ */ new WeakSet();
    let control = null;
    let busy = false;
    const changed = () => {
      if (busy) return;
      busy = true;
      try {
        for (const fn of [...listeners]) {
          try {
            fn();
          } catch {
          }
        }
      } finally {
        busy = false;
      }
    };
    const owns = (el2) => !!el2 && owned.has(el2);
    const dialog = win.HTMLDialogElement?.prototype;
    if (dialog?.showModal) {
      const showModal = dialog.showModal;
      dialog.showModal = function() {
        showModal.call(this);
        changed();
      };
    }
    const el = win.HTMLElement?.prototype;
    if (el?.showPopover) {
      const showPopover = el.showPopover;
      el.showPopover = function(...args) {
        showPopover.apply(this, args);
        if (!owns(this)) changed();
      };
    }
    if (el?.togglePopover) {
      const togglePopover = el.togglePopover;
      el.togglePopover = function(...args) {
        const r = togglePopover.apply(this, args);
        if (!owns(this)) changed();
        return r;
      };
    }
    const element = win.Element?.prototype;
    if (element?.requestFullscreen) {
      const requestFullscreen = element.requestFullscreen;
      element.requestFullscreen = function(options) {
        return requestFullscreen.call(this, options).then((v) => {
          changed();
          return v;
        });
      };
    }
    win.addEventListener(
      "toggle",
      (e) => {
        if (!owns(e.target)) changed();
      },
      true
    );
    win.addEventListener("close", (e) => {
      if (!owns(e.target)) changed();
    }, true);
    win.document.addEventListener("fullscreenchange", changed);
    for (const type of GUARDED) {
      win.addEventListener(
        type,
        (e) => {
          const path = e.composedPath();
          if (!path.some(owns)) return;
          if (type === "mousedown" || type === "pointerdown" || type === "touchstart") {
            if (e.cancelable && type === "mousedown") e.preventDefault();
          }
          if (type === "click") control?.(path, e);
          e.stopImmediatePropagation();
        },
        { capture: true, passive: false }
      );
    }
    const api = {
      onChange(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      own(e) {
        owned.add(e);
      },
      owns,
      onControl(fn) {
        control = fn;
      }
    };
    Object.defineProperty(win, KEY2, { value: api, configurable: false, enumerable: false, writable: false });
    return api;
  }
  function topmostModal(doc, order) {
    const open = [...doc.querySelectorAll("dialog[open]")].filter((d) => safeMatches(d, ":modal"));
    const known = order.filter((d) => open.includes(d));
    const next = [...known, ...open.filter((d) => !known.includes(d))];
    order.splice(0, order.length, ...next);
    return next.at(-1) ?? null;
  }
  function topmostAutoPopover(doc, order, mine) {
    const open = [...doc.querySelectorAll("[popover]")].filter((p) => !mine(p) && safeMatches(p, ":popover-open") && (p.getAttribute("popover") || "auto") === "auto");
    const known = order.filter((p) => open.includes(p));
    const next = [...known, ...open.filter((p) => !known.includes(p))];
    order.splice(0, order.length, ...next);
    return next.at(-1) ?? null;
  }
  function safeMatches(el, selector) {
    try {
      return el.matches(selector);
    } catch {
      return false;
    }
  }

  // toolkit/runtime/src/overlay/index.ts
  var OVERLAY_TAG = "showcase-overlay";
  var CONTROLS_TAG = "showcase-controls";
  function make2(doc, tag, attrs = {}, ...children) {
    const el = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    for (const c of children) if (c) el.append(c);
    return el;
  }
  var SVG = "http://www.w3.org/2000/svg";
  function icon(doc, d) {
    const svg = doc.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = doc.createElementNS(SVG, "path");
    path.setAttribute("d", d);
    svg.append(path);
    return svg;
  }
  var ICONS = {
    back: "M6 5h2v14H6zM20 5v14L9 12z",
    next: "M16 5h2v14h-2zM4 5l11 7-11 7z",
    play: "M7 4.5v15L19.5 12z",
    pause: "M6.5 5h4v14h-4zM13.5 5h4v14h-4z",
    sound: "M4 9h4l5-4v14l-5-4H4zM16 8.5a5 5 0 0 1 0 7l-1.4-1.4a3 3 0 0 0 0-4.2zM18.4 6a8.5 8.5 0 0 1 0 12L17 16.6a6.5 6.5 0 0 0 0-9.2z",
    muted: "M4 9h4l5-4v14l-5-4H4zM16.3 8.9l1.4-1.4 2.1 2.1 2.1-2.1 1.4 1.4-2.1 2.1 2.1 2.1-1.4 1.4-2.1-2.1-2.1 2.1-1.4-1.4 2.1-2.1z",
    exit: "M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z"
  };
  function pointerSvg(doc) {
    const svg = doc.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", "0 0 30 30");
    svg.setAttribute("aria-hidden", "true");
    const path = doc.createElementNS(SVG, "path");
    path.setAttribute("d", "M1.5 1.5 L1.5 23 L7.2 17.6 L11.4 27 L15.3 25.3 L11.2 16.1 L19 16.1 Z");
    path.setAttribute("fill", "#0f172a");
    path.setAttribute("stroke", "#ffffff");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linejoin", "round");
    svg.append(path);
    return svg;
  }
  function sheetOf(doc, css) {
    try {
      const View = doc.defaultView;
      const sheet = new (View?.CSSStyleSheet ?? CSSStyleSheet)();
      sheet.replaceSync(css);
      return sheet;
    } catch {
      return null;
    }
  }
  var FONT_MARK = "__showcaseFonts";
  function declareFonts(doc) {
    const d = doc;
    if (d[FONT_MARK]) return;
    const sheet = sheetOf(doc, FONT_CSS);
    if (!sheet) return;
    try {
      doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
      d[FONT_MARK] = true;
    } catch {
    }
  }
  function createOverlay(options) {
    const doc = options.document ?? document;
    const win = doc.defaultView;
    const speed = options.speed ?? (() => 1);
    const ui = options.ui;
    const top = options.topLayer ?? null;
    const raf = options.natives?.requestAnimationFrame ?? ((fn) => win ? win.requestAnimationFrame(fn) : 0);
    const caf = options.natives?.cancelAnimationFrame ?? ((id) => win?.cancelAnimationFrame(id));
    const MO = options.natives?.MutationObserver ?? win?.MutationObserver ?? MutationObserver;
    let reduced = options.reducedMotion ?? false;
    if (!reduced && ui === "watch") {
      try {
        reduced = !!win?.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      } catch {
        reduced = false;
      }
    }
    const wantsControls = options.controls ?? ui === "watch";
    const wantsCaptions = options.captions ?? ui !== "film";
    declareFonts(doc);
    const host = make2(doc, OVERLAY_TAG, { popover: "manual", "aria-hidden": "true", "data-ui": ui, "data-controls": wantsControls ? "on" : "off" });
    if (reduced) host.setAttribute("data-motion", "reduce");
    const root = host.attachShadow({ mode: "open" });
    const sheet = sheetOf(doc, OVERLAY_CSS);
    if (sheet) root.adoptedStyleSheets = [sheet];
    const card = make2(doc, "div", { class: "card", hidden: "" });
    const spot = make2(doc, "div", { class: "spot", hidden: "" });
    const callout = make2(doc, "div", { class: "callout", hidden: "" });
    const pointer = make2(doc, "div", { class: "pointer", hidden: "" }, pointerSvg(doc));
    const ripple = make2(doc, "div", { class: "ripple" });
    const captionText = make2(doc, "p", { class: "caption", "aria-live": "polite" });
    const captions = make2(doc, "div", { class: "captions", hidden: "" }, captionText);
    const end = make2(doc, "div", { class: "end", hidden: "" });
    const layer = make2(doc, "div", { class: "layer" }, card, spot, callout, captions, end, ripple, pointer);
    root.append(layer);
    top?.own(host);
    let controlsHost = null;
    let croot = null;
    const buttons = {};
    let label = null;
    let stuck = null;
    if (wantsControls) {
      controlsHost = make2(doc, CONTROLS_TAG, { "data-showcase": "controls" });
      croot = controlsHost.attachShadow({ mode: "open" });
      const csheet = sheetOf(doc, CONTROLS_CSS);
      if (csheet) croot.adoptedStyleSheets = [csheet];
      const button = (c, name, d, text) => {
        const b = make2(doc, "button", { type: "button", tabindex: "-1", "data-c": c, "aria-label": name, title: name });
        if (d) b.append(icon(doc, d));
        if (text) {
          b.className = "text";
          b.append(text);
        }
        buttons[c] = b;
        return b;
      };
      label = make2(doc, "span", { class: "label" });
      stuck = make2(doc, "span", { class: "stuck", hidden: "" });
      const retry = button("retry", "Retry", null, "Retry");
      const skip = button("skip", "Skip", null, "Skip");
      retry.hidden = true;
      skip.hidden = true;
      const bar = make2(
        doc,
        "div",
        { class: "bar", role: "toolbar", "aria-label": "Tour controls" },
        button("back", "Back (←)", ICONS.back),
        button("toggle", "Pause (Space)", ICONS.pause),
        button("next", "Next (→)", ICONS.next),
        label,
        stuck,
        retry,
        skip,
        make2(doc, "span", { class: "sep" }),
        button("mute", "Mute (M)", ICONS.sound),
        button("exit", "Exit (Esc)", ICONS.exit)
      );
      croot.append(bar);
      top?.own(controlsHost);
      const act = (path) => {
        const b = path.find((n) => n.dataset?.c);
        const c = b?.dataset.c;
        if (c) options.onCommand?.(c);
      };
      if (top) top.onControl(act);
      else {
        bar.addEventListener("mousedown", (e) => e.preventDefault());
        bar.addEventListener("click", (e) => {
          act(e.composedPath());
          e.stopPropagation();
        });
      }
      root.append(controlsHost);
    }
    const owns = (el) => el === host || host.contains(el) || root.contains(el) || !!controlsHost && (el === controlsHost || controlsHost.contains(el) || !!croot?.contains(el));
    const modals = [];
    const autos = [];
    function placeControls() {
      if (!controlsHost) return;
      let target = null;
      try {
        target = doc.fullscreenElement ?? topmostModal(doc, modals) ?? topmostAutoPopover(doc, autos, (el) => el === host);
      } catch {
        target = null;
      }
      const want = target ?? root;
      if (controlsHost.parentNode !== want) want.append(controlsHost);
    }
    function attach() {
      const html = doc.documentElement;
      if (!html) return;
      if (host.parentNode !== html) html.append(host);
      try {
        if (!safeMatches(host, ":popover-open")) host.showPopover();
      } catch {
      }
    }
    function raise() {
      placeControls();
      if (!host.isConnected) attach();
      try {
        if (safeMatches(host, ":popover-open")) host.hidePopover();
        host.showPopover();
      } catch {
      }
    }
    attach();
    placeControls();
    const unsubscribe = top?.onChange(raise) ?? (() => {
    });
    let pending = 0;
    const observer = new MO(() => {
      if (!host.isConnected) {
        raise();
        return;
      }
      if (controlsHost && !pending) {
        pending = raf(() => {
          pending = 0;
          placeControls();
        });
      }
    });
    if (controlsHost) observer.observe(doc, { childList: true, subtree: true, attributes: true, attributeFilter: ["open", "popover"] });
    else if (doc.documentElement) observer.observe(doc.documentElement, { childList: true });
    let at = null;
    let travel = null;
    const drawPointer = options.pointer !== false;
    const place = (x, y) => {
      pointer.style.transform = `translate(${x}px, ${y}px)`;
      ripple.style.transform = `translate(${x}px, ${y}px)`;
      if (drawPointer) pointer.hidden = false;
    };
    let spotted = null;
    let follow = 0;
    let lastRect = null;
    const PAD = 6;
    const same = (a, b) => Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5;
    function drawSpot(r) {
      Object.assign(spot.style, { left: `${r.x - PAD}px`, top: `${r.y - PAD}px`, width: `${r.w + PAD * 2}px`, height: `${r.h + PAD * 2}px` });
      if (!spotted?.callout) {
        callout.hidden = true;
        return;
      }
      callout.hidden = false;
      const vw = win?.innerWidth ?? 1280;
      const vh = win?.innerHeight ?? 720;
      const foot = (wantsControls ? 80 : 0) + (wantsCaptions && !captions.hidden ? 72 : 0);
      const size = { w: callout.offsetWidth, h: callout.offsetHeight };
      const p = placeCallout({ x: r.x - PAD, y: r.y - PAD, w: r.w + PAD * 2, h: r.h + PAD * 2 }, size, { w: vw, h: vh, top: 0, bottom: foot });
      callout.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
      callout.setAttribute("data-side", p.side);
    }
    function followLoop() {
      follow = 0;
      if (!spotted) return;
      const el = spotted.el;
      if (el?.isConnected) {
        const r = rectOf(el);
        if (!lastRect || !same(r, lastRect)) {
          lastRect = r;
          drawSpot(r);
        }
      }
      follow = raf(followLoop);
    }
    function setCaption(text) {
      if (!wantsCaptions) return;
      captionText.textContent = text ?? "";
      captions.hidden = text === null;
    }
    function fillCard(el, c) {
      el.replaceChildren();
      if (!c) {
        el.hidden = true;
        return;
      }
      el.append(make2(doc, "h1", {}, c.title));
      if (c.lines.length) el.append(make2(doc, "ul", {}, ...c.lines.map((l) => make2(doc, "li", {}, l))));
      el.hidden = false;
    }
    const overlay = {
      host,
      controlsHost,
      async pointerTo(rect, signal) {
        const to = { x: Math.round(rect.x + rect.w / 2), y: Math.round(rect.y + rect.h / 2) };
        const from = at ?? { x: Math.round((win?.innerWidth ?? 0) / 2), y: Math.round((win?.innerHeight ?? 0) / 2) };
        if (!at) place(from.x, from.y);
        travel?.cancel();
        if (signal?.aborted) throw new Aborted();
        const dist = Math.hypot(to.x - from.x, to.y - from.y);
        const ms = Math.min(700, Math.max(120, dist * 0.9)) / Math.max(0.1, speed());
        if (reduced || typeof pointer.animate !== "function" || dist < 1) {
          place(to.x, to.y);
          at = to;
          return;
        }
        const a = pointer.animate([{ transform: `translate(${from.x}px, ${from.y}px)` }, { transform: `translate(${to.x}px, ${to.y}px)` }], {
          duration: ms,
          easing: "cubic-bezier(.4,0,.2,1)",
          fill: "forwards"
        });
        travel = a;
        const stop = () => a.cancel();
        signal?.addEventListener("abort", stop, { once: true });
        try {
          await a.finished;
        } catch {
          if (signal?.aborted) throw new Aborted();
        } finally {
          signal?.removeEventListener("abort", stop);
        }
        place(to.x, to.y);
        try {
          a.cancel();
        } catch {
        }
        if (travel === a) travel = null;
        at = to;
      },
      press() {
        if (!at || reduced || typeof ripple.animate !== "function") return;
        ripple.animate(
          [
            { opacity: 0.95, transform: `translate(${at.x}px, ${at.y}px) scale(0.35)` },
            { opacity: 0, transform: `translate(${at.x}px, ${at.y}px) scale(1.5)` }
          ],
          { duration: 360 / Math.max(0.1, speed()), easing: "ease-out" }
        );
      },
      spotlight(target) {
        if (follow) caf(follow);
        follow = 0;
        lastRect = null;
        if (!target) {
          spotted = null;
          spot.hidden = true;
          callout.hidden = true;
          callout.replaceChildren();
          return;
        }
        spotted = { el: target.element ?? null, rect: target.rect, callout: target.callout };
        callout.replaceChildren();
        if (target.callout) callout.append(make2(doc, "h2", {}, target.callout.title), make2(doc, "p", {}, target.callout.body));
        spot.hidden = false;
        lastRect = target.rect;
        drawSpot(target.rect);
        if (spotted.el) follow = raf(followLoop);
      },
      card(c) {
        if (c) overlay.spotlight(null);
        fillCard(card, c);
        pointer.style.visibility = c ? "hidden" : "";
      },
      caption(text) {
        if (text === null && options.lingerCaptions) return;
        setCaption(text);
      },
      clearCaption() {
        setCaption(null);
      },
      acting(on) {
        for (const el of [host, controlsHost]) {
          if (!el) continue;
          if (on) el.setAttribute("data-acting", "");
          else el.removeAttribute("data-acting");
        }
      },
      owns,
      pointer: () => at,
      movePointer(x, y) {
        at = { x: Math.round(x), y: Math.round(y) };
        place(at.x, at.y);
      },
      view(v) {
        if (controlsHost) {
          const toggle = buttons.toggle;
          if (toggle) {
            const playing = !v.paused && v.status !== "blocked" && v.status !== "done";
            toggle.replaceChildren(icon(doc, playing ? ICONS.pause : ICONS.play));
            const name = playing ? "Pause (Space)" : "Play (Space)";
            toggle.setAttribute("aria-label", name);
            toggle.setAttribute("title", name);
          }
          const mute = buttons.mute;
          if (mute) {
            mute.replaceChildren(icon(doc, v.muted ? ICONS.muted : ICONS.sound));
            mute.setAttribute("aria-label", v.muted ? "Unmute (M)" : "Mute (M)");
          }
          if (label) label.textContent = v.stepCount ? `${Math.min(v.stepIndex + 1, v.stepCount)} / ${v.stepCount}` : "";
          if (stuck) {
            stuck.textContent = v.blocked ?? "";
            stuck.hidden = !v.blocked;
          }
          if (buttons.retry) buttons.retry.hidden = !v.blocked;
          if (buttons.skip) buttons.skip.hidden = !v.blocked;
        }
        if (ui === "watch" && v.ended === "finished") {
          end.replaceChildren(
            make2(doc, "span", { class: "kicker" }, "That's the tour"),
            make2(doc, "h1", {}, options.title ?? "Thanks for watching"),
            make2(doc, "p", {}, wantsControls ? "Press Esc to close, or ← to go back." : "")
          );
          end.hidden = false;
        } else end.hidden = true;
      },
      raise,
      destroy() {
        unsubscribe();
        observer.disconnect();
        if (follow) caf(follow);
        if (pending) caf(pending);
        travel?.cancel();
        if (top) top.onControl(null);
        controlsHost?.remove();
        host.remove();
      }
    };
    return overlay;
  }

  // toolkit/runtime/src/index.ts
  var RUNTIME_VERSION = true ? "0.1.0" : "dev";
  var STILL_MS = 400;
  async function filmReady(n, signal, doc) {
    await doc.fonts?.ready;
    await nextFrame(n);
    await nextFrame(n);
    await new Promise((resolve2) => {
      const timer = n.setTimeout(resolve2, STILL_MS);
      signal.addEventListener(
        "abort",
        () => {
          n.clearTimeout(timer);
          resolve2();
        },
        { once: true }
      );
    });
  }
  function samePath(win, path) {
    const here = `${win.location.pathname}${win.location.search}`;
    return here === path || win.location.pathname === path;
  }
  function uiOf(config) {
    return config.mode === "film" ? "film" : config.rehearse ? "rehearse" : "watch";
  }
  function command(api, bridge, c) {
    const snap = api.snapshot();
    if (!snap) return;
    switch (c) {
      case "toggle":
        api.dispatch({ type: snap.paused ? "resume" : "pause" });
        return;
      case "back":
        api.dispatch({ type: "back" });
        return;
      case "next":
        api.dispatch({ type: "next" });
        return;
      case "mute":
        api.dispatch({ type: "mute" });
        return;
      case "retry":
        api.dispatch({ type: "retry" });
        return;
      case "skip":
        api.dispatch({ type: "skip" });
        return;
      case "exit":
        if (snap.status === "done") bridge.exit();
        else api.dispatch({ type: "end" });
        return;
    }
  }
  async function bootDirector(win, api, config, n, adapters, top) {
    const doc = win.document;
    const bridge = createBridge(win);
    let storage = null;
    try {
      storage = win.sessionStorage;
    } catch {
      storage = null;
    }
    const store = bridge.present ? hostStore({ load: () => bridge.loadState(), save: (s) => bridge.saveState(s), clear: () => bridge.clearState() }) : storageStore(storage, n.dateNow);
    const prior = await store.load();
    const resumed = prior !== null && prior.tourId === config.tour.id;
    const docNumber = resumed && prior ? prior.doc + 1 : 1;
    const ctx = { document: doc, anchors: config.tour.anchors ?? {} };
    let speed = config.speed ?? 1;
    const ui = uiOf(config);
    const overlay = createOverlay({
      document: doc,
      topLayer: top,
      natives: n,
      speed: () => speed,
      ui,
      pointer: config.pointer !== false,
      lingerCaptions: ui === "rehearse",
      ...ui === "rehearse" ? { reducedMotion: true } : {},
      title: config.tour.title,
      onCommand: (c) => command(api, bridge, c)
    });
    api.overlay = overlay;
    if (resumed && prior?.pointer) overlay.movePointer(prior.pointer.x, prior.pointer.y);
    let audio = null;
    if (ui === "watch") {
      audio = createBridgeAudio({
        bridge,
        document: doc,
        manifest: config.manifest ?? null,
        ...config.muted !== void 0 ? { muted: config.muted } : {},
        storage,
        setTimeout: n.setTimeout,
        clearTimeout: n.clearTimeout
      });
      const a = audio;
      api.audio = {
        get played() {
          return a.stats.played;
        },
        get failed() {
          return a.stats.failed;
        },
        get muted() {
          return a.muted;
        }
      };
    }
    const publish = (snapshot) => {
      bridge.snapshot(snapshot);
      if (!snapshot) return;
      overlay.view({
        status: snapshot.status,
        stepIndex: snapshot.stepIndex,
        stepCount: snapshot.stepCount,
        paused: snapshot.paused,
        muted: snapshot.muted,
        blocked: snapshot.blocked ? snapshot.blocked.message : null,
        ended: snapshot.ended?.reason ?? null
      });
    };
    const timers = { now: n.perfNow, setTimeout: n.setTimeout, clearTimeout: n.clearTimeout };
    const director = new Director({
      tour: config.tour,
      clocks: (s) => {
        speed = s;
        return createClocks(s, timers);
      },
      executor: ({ clocks, onPhase, onCamera, onNote }) => createExecutor({
        pace: clocks.pace,
        wall: clocks.wall,
        ctx,
        natives: n,
        bridge,
        ...config.input ? { input: config.input } : {},
        overlay,
        invoke: async (name, args) => {
          const fn = adapters.get(name);
          if (!fn) throw new Error(`no adapter registered for invoke '${name}'`);
          return fn(args);
        },
        onPhase,
        onCamera,
        onNote: (note) => {
          onNote(note);
          bridge.log("info", note);
        },
        acting: (a) => {
          api.acting = a;
        },
        frame: () => nextFrame(n)
      }),
      waitFor: (ready, options) => waitFor(ready, { clock: options.clock, ctx: contextOf(ctx), timeoutMs: options.timeoutMs, ...options.signal ? { signal: options.signal } : {} }),
      navigate: (path, signal) => {
        if (samePath(win, path)) return Promise.resolve();
        win.location.assign(path);
        return signal ? whenAborted(signal) : new Promise(() => {
        });
      },
      store,
      timeline: (stamp) => createTimeline({ stamp, t: () => n.timeOrigin + n.perfNow(), wall: n.dateNow, window: win, ...bridge.present ? { send: (e) => bridge.event(e) } : {} }),
      manifest: config.manifest ?? null,
      audio,
      overlay,
      publish,
      ...ui === "rehearse" && bridge.present ? {
        checkpoint: async ({ stepIndex, beatIndex, step, beat }) => {
          await nextFrame(n);
          await nextFrame(n);
          const card = beat.card ? { title: beat.card.title, lines: beat.card.lines ?? [] } : null;
          await bridge.checkpoint({ stepIndex, beatIndex, step: step.id, beat: beat.id, narration: (beat.narration ?? []).map(sentenceText), card });
          overlay.clearCaption();
        }
      } : {},
      now: n.dateNow,
      viewport: () => ({ w: win.innerWidth, h: win.innerHeight, dpr: win.devicePixelRatio || 1 }),
      filmReady: (signal) => filmReady(n, signal, doc),
      waitGo: () => waitForGo(win).armed,
      frame: () => nextFrame(n),
      runtimeVersion: RUNTIME_VERSION,
      doc: docNumber
    });
    api.director = director;
    api.config = config;
    bridge.ready({ doc: docNumber, resumed, url: win.location.href });
    if (resumed && prior) director.resume(prior);
    else if (config.autostart !== false) director.start({ mode: config.mode, speed: config.speed ?? 1, ...config.from ? { from: config.from } : {} });
  }
  function isViewerInput(api, n, e) {
    if (!e.isTrusted) return false;
    const a = api.acting;
    if (!a) return true;
    return n.perfNow() > a.deadline;
  }
  function boot(win = window) {
    if (!isTopFrame(win)) return null;
    const w = win;
    if (w[API_KEY]) return w[API_KEY];
    const n = captureNatives(win);
    const top = installTopLayer(win);
    const adapters = /* @__PURE__ */ new Map();
    let bootedResolve = () => {
    };
    const api = {
      version: RUNTIME_VERSION,
      director: null,
      config: null,
      acting: null,
      booted: new Promise((resolve2) => {
        bootedResolve = resolve2;
      }),
      dispatch: (command2) => api.director?.dispatch(command2),
      snapshot: () => api.director?.snapshot ?? null,
      events: () => api.director?.events ?? [],
      start: async (config) => {
        const c = config ?? w.__showcaseConfig;
        if (!c) throw new Error("no showcase config");
        if (api.director) {
          api.director.start({ mode: c.mode, speed: c.speed ?? 1, ...c.from ? { from: c.from } : {} });
          return;
        }
        await bootDirector(win, api, { ...c, autostart: true }, n, adapters, top);
      },
      actions: {
        register: (name, fn) => {
          adapters.set(name, fn);
        },
        has: (name) => adapters.has(name)
      },
      overlay: null,
      audio: null,
      inspect: (options) => outline(win.document, options),
      visibleText: () => visibleText(win.document),
      film: createFilmAids(win, n)
    };
    Object.defineProperty(win, API_KEY, { value: api, configurable: true, enumerable: false, writable: false });
    const early = w.__showcaseConfig;
    if (w[ROLLING_KEY] === true && early?.mode === "film") api.film.heartbeat(true);
    const watching = () => {
      const snap = api.snapshot();
      return snap && snap.mode === "watch" && api.config && uiOf(api.config) === "watch" ? snap : null;
    };
    win.addEventListener(
      "pointerdown",
      (e) => {
        const snap = watching();
        if (!snap || snap.status !== "playing") return;
        if (isViewerInput(api, n, e)) api.dispatch({ type: "pause" });
      },
      true
    );
    const KEYS = { " ": "toggle", Spacebar: "toggle", ArrowLeft: "back", ArrowRight: "next", m: "mute", M: "mute", Escape: "exit" };
    win.addEventListener(
      "keydown",
      (e) => {
        const c = KEYS[e.key];
        if (!c || e.altKey || e.ctrlKey || e.metaKey || !watching() || !isViewerInput(api, n, e)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!e.repeat) command(api, createBridge(win), c);
      },
      true
    );
    const ready = () => {
      const config = w.__showcaseConfig;
      const done = () => bootedResolve();
      if (!config || !/^(https?|file):$/.test(win.location.protocol)) {
        done();
        return;
      }
      bootDirector(win, api, config, n, adapters, top).then(done, (e) => {
        createBridge(win).log("warn", `boot failed: ${e instanceof Error ? e.message : String(e)}`);
        done();
      });
    };
    if (win.document.readyState === "loading") win.document.addEventListener("DOMContentLoaded", ready, { once: true });
    else ready();
    return api;
  }

  // toolkit/runtime/src/inject.ts
  boot();
})();
