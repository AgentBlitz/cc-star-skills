// The fixture app's behaviour: the hard cases a tour meets in real apps (PLAN §5 Session 2).
// No framework and no test ids; elements are found by role, label and text, as in Star.
// Every button or link activation is recorded in `window.fixtureEvents` (like an analytics log),
// so the spikes can tell where a click really landed and whether it was trusted.
(() => {
  const events = (window.fixtureEvents = []);
  const status = () => document.querySelector('[role="status"]');

  function labelOf(el) {
    return (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ");
  }

  function record(label, e) {
    events.push({ label, trusted: e.isTrusted, page: location.pathname, t: Math.round(performance.now()) });
    const s = status();
    if (s) s.textContent = `Last action: ${label}`;
  }

  document.addEventListener("click", (e) => {
    const el = e.target instanceof Element ? e.target.closest("button, a, [role=menuitem]") : null;
    if (el) record(labelOf(el), e);
  });

  // Cookie banner, dismissed for the browser session.
  const banner = document.querySelector(".cookie-banner");
  if (banner) {
    if (sessionStorage.getItem("cookies") === "decided") banner.hidden = true;
    banner.addEventListener("click", (e) => {
      if (e.target instanceof HTMLButtonElement) {
        sessionStorage.setItem("cookies", "decided");
        banner.hidden = true;
      }
    });
  }

  // A Radix-like menu: opens on click, closes on Escape, on choosing an item, and on a pointerdown
  // or focus outside it (Radix's DismissableLayer listens on the document, in the bubble phase).
  const trigger = document.querySelector('button[aria-haspopup="menu"]');
  const menu = trigger && document.getElementById(trigger.getAttribute("aria-controls"));
  if (trigger && menu) {
    const outside = (e) => {
      if (!menu.contains(e.target) && !trigger.contains(e.target)) close();
    };
    const close = () => {
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
    };
    const open = () => {
      menu.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      menu.querySelector('[role="menuitem"]')?.focus();
      // Registered after the opening click has finished, as Radix does.
      setTimeout(() => {
        document.addEventListener("pointerdown", outside);
        document.addEventListener("focusin", outside);
      }, 0);
    };
    trigger.addEventListener("click", () => (menu.hidden ? open() : close()));
    menu.addEventListener("click", (e) => {
      if (e.target instanceof Element && e.target.closest('[role="menuitem"]')) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !menu.hidden) close();
    });
  }

  // The modal dialog.
  const dialog = document.querySelector("dialog");
  document.querySelector("[data-opens-dialog]")?.addEventListener("click", () => dialog?.showModal());
  dialog?.querySelector("[data-closes-dialog]")?.addEventListener("click", () => dialog.close());

  // Full screen.
  const panel = document.querySelector(".chart-panel");
  for (const b of document.querySelectorAll("[data-fullscreen]")) {
    b.addEventListener("click", () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else panel?.requestFullscreen();
    });
  }

  // The animated chart.
  const canvas = document.querySelector("canvas");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    const draw = (now) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = "#0e1628";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#24314a";
      for (let y = 40; y < h; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const y = h / 2 + Math.sin(x / 50 + now / 400) * h * 0.25 + Math.sin(x / 17 + now / 900) * 12;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      const bx = ((now / 8) % (w + 40)) - 20;
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(bx, h / 2 + Math.sin(bx / 50 + now / 400) * h * 0.25, 7, 0, Math.PI * 2);
      ctx.fill();
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  }

  // Drag and drop.
  const card = document.querySelector('[draggable="true"]');
  const zone = document.querySelector(".dropzone");
  if (card && zone) {
    card.addEventListener("dragstart", (e) => e.dataTransfer?.setData("text/plain", card.textContent ?? ""));
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.classList.add("over");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("over"));
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("over");
      zone.append(card);
      record("Archived by drag", e);
    });
  }

  // File input.
  document.querySelector('input[type="file"]')?.addEventListener("change", (e) => {
    const names = [...(e.target.files ?? [])].map((f) => f.name).join(", ");
    record(`Attached ${names}`, e);
  });

  // window.open link.
  document.querySelector("[data-help-window]")?.addEventListener("click", (e) => {
    e.preventDefault();
    window.open("/detail.html?id=help", "ledgerly-help", "width=640,height=480");
  });

  // The settings form.
  document.querySelector("form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    record("Saved settings", e);
  });

  // The History-API route (spa.html, served at /spa and /spa/*).
  const outlet = document.querySelector("[data-spa-outlet]");
  if (outlet) {
    const views = {
      "/spa": ["Overview", "Your workspace at a glance."],
      "/spa/settings": ["Settings", "Workspace name, region and billing."],
      "/spa/members": ["Members", "Twelve people have access to this workspace."],
    };
    const render = () => {
      const path = location.pathname.replace(/\/$/, "").replace(/\.html$/, "");
      const [title, text] = views[path] ?? views["/spa"];
      outlet.innerHTML = "";
      const h = document.createElement("h1");
      h.textContent = title;
      const p = document.createElement("p");
      p.textContent = text;
      outlet.append(h, p);
      document.title = `${title} · Ledgerly`;
    };
    document.addEventListener("click", (e) => {
      const a = e.target instanceof Element ? e.target.closest("a[data-spa-link]") : null;
      if (!a) return;
      e.preventDefault();
      history.pushState({}, "", a.getAttribute("href"));
      render();
    });
    window.addEventListener("popstate", render);
    render();
  }
})();
