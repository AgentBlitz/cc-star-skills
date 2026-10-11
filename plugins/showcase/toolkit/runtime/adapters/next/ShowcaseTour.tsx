"use client";
/**
 * The showcase tour's Next adapter, vendored by `showcase runtime vendor` (showcase {{version}}).
 * Generated: re-vendoring rewrites this file. The app's own parts (reset, beforeStart, the
 * tour's `invoke` actions) go in `./showcase-adapter.ts`, which vendoring never overwrites.
 *
 * Mount it once, in the root layout: `<ShowcaseTour />`. It renders nothing, and it loads the
 * runtime only when the URL has `?showcase=<id>` or the tab is part-way through a tour, so no
 * page pays for it otherwise. Steps move through Next's router, on one document load.
 *
 * A `<Link href="/?showcase=<id>">` works as the entry point: the first tour in a document starts
 * in place, and a later one reloads the page first (the runtime runs one tour per document).
 */
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { adapter } from "./showcase-adapter";

function wanted(): boolean {
  if (new URLSearchParams(window.location.search).has("showcase")) return true;
  // `film --in-app`: the recorder holds the run, so a page load mid-film finds nothing in the tab.
  // (When the recorder injects its own runtime, `__showcase` is already here: leave it alone.)
  const w = window as unknown as Record<string, unknown>;
  if (typeof w["__showcaseHost"] === "function" && w["__showcase"] === undefined) return true;
  try {
    return window.sessionStorage.getItem("showcase:run") !== null;
  } catch {
    return false;
  }
}

/** Whether this document has handed the runtime a tour, and the link the last effect saw. */
let started = false;
let lastLink: string | null = null;

function Tour(): null {
  const router = useRouter();
  // A `<Link>` to the tour is a soft navigation, with no document load: watch the URL for it.
  const link = useSearchParams().get("showcase");
  useEffect(() => {
    // The runtime takes its link off the URL, so a link that comes back is a new request.
    const again = started && link !== null && lastLink === null;
    lastLink = link;
    if (!wanted()) return;
    if (again) {
      window.location.reload();
      return;
    }
    started = true;
    import("./runtime/showcase-runtime.mjs")
      .then(({ startInApp }) => {
        const linked = new URLSearchParams(window.location.search).has("showcase");
        const run = startInApp({ base: "{{base}}", ...adapter, navigate: (url: string) => router.push(url) });
        // The runtime has taken its link off the URL, keeping `history.state`. Next's router only
        // follows a history call that doesn't carry its own state, so tell it the URL again.
        if (linked && !new URLSearchParams(window.location.search).has("showcase")) window.history.replaceState(null, "", window.location.href);
        return run;
      })
      .catch((e: unknown) => console.warn("showcase:", e));
  }, [router, link]);
  return null;
}

export default function ShowcaseTour() {
  // `useSearchParams` needs a Suspense boundary wherever a page is prerendered.
  return (
    <Suspense fallback={null}>
      <Tour />
    </Suspense>
  );
}
