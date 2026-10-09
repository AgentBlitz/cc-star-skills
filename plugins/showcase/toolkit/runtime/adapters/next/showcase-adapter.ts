/**
 * The app's side of the showcase tour (written once by `showcase runtime vendor`; yours to edit,
 * never overwritten). `ShowcaseTour.tsx` passes it to the runtime with Next's router.
 */
import type { Adapter } from "./runtime/showcase-runtime.mjs";

export const adapter: Adapter = {
  // Puts the app's data back before a tour starts from a link (not on a reload):
  // reset: async () => {
  //   await fetch("/api/showcase/reset", { method: "POST" });
  // },
  // Before every start, for example a scripted AI for this browser:
  // beforeStart: ({ tour }) => {
  //   document.cookie = `showcase-tour=${tour.id}; path=/; SameSite=Lax`;
  // },
  // The tour's `invoke` actions, by name:
  // actions: {
  //   "open-palette": () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true })),
  // },
};
