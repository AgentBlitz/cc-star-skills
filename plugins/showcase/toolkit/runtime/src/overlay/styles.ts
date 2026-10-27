/**
 * The overlay's styles. They go in as adopted stylesheets only, which a CSP or Trusted Types
 * policy can't refuse; fonts are declared at document level, because `@font-face` inside a shadow
 * root is ignored. `:host{all:initial}` keeps the app's styles out.
 */

export const FONT_FAMILY = "Showcase UI";

/** Declared on the document: system faces only, so nothing is fetched. */
export const FONT_CSS = `
@font-face { font-family: "${FONT_FAMILY}"; font-weight: 400; src: local("Inter"), local("Inter Regular"), local("SF Pro Text"), local("Helvetica Neue"), local("Segoe UI"), local("Roboto"), local("Arial"); }
@font-face { font-family: "${FONT_FAMILY}"; font-weight: 600; src: local("Inter SemiBold"), local("Inter Semi Bold"), local("SF Pro Text Semibold"), local("HelveticaNeue-Medium"), local("Segoe UI Semibold"), local("Roboto Medium"), local("Arial Bold"); }
`;

/** The overlay's font stack; a brand's faces go in front of it. */
export const FONT = `"${FONT_FAMILY}", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;

export const OVERLAY_CSS = `
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

/**
 * A card's mark and kicker (showcase 1.1), a sheet of their own so `OVERLAY_CSS` stays 1.0's: a
 * card without them looks exactly as it did. A brand (`brand.ts`) restyles both.
 */
export const CARD_CSS = `
.card .kicker { margin: -12px 0 0; font: 600 clamp(14px, 2vh, 22px)/1.2 ${FONT}; letter-spacing: 0.24em; text-transform: uppercase; color: #93c5fd; }
.mark { display: flex; justify-content: center; color: #93c5fd; }
.mark svg { display: block; width: auto; height: clamp(56px, 10vh, 112px); overflow: visible; }
`;

export const CONTROLS_CSS = `
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
