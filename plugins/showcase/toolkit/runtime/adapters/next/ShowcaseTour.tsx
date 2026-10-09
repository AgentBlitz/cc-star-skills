"use client";
/**
 * The showcase tour's Next adapter, vendored by `showcase runtime vendor` (showcase {{version}}).
 * Generated: re-vendoring rewrites this file. The app's own parts (reset, beforeStart, the
 * tour's `invoke` actions) go in `./showcase-adapter.ts`, which vendoring never overwrites.
 *
 * Mount it once, in the root layout: `<ShowcaseTour />`. It renders nothing, and it loads the
 * runtime only when the URL has `?showcase=<id>` or the tab is part-way through a tour, so no
 * page pays for it otherwise. Steps move through Next's router, on one document load.
 */
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { adapter } from "./showcase-adapter";

function wanted(): boolean {
  if (new URLSearchParams(window.location.search).has("showcase")) return true;
  try {
    return window.sessionStorage.getItem("showcase:run") !== null;
  } catch {
    return false;
  }
}

export default function ShowcaseTour(): null {
  const router = useRouter();
  useEffect(() => {
    if (!wanted()) return;
    import("./runtime/showcase-runtime.mjs")
      .then(({ startInApp }) => startInApp({ base: "{{base}}", ...adapter, navigate: (url: string) => router.push(url) }))
      .catch((e: unknown) => console.warn("showcase:", e));
  }, [router]);
  return null;
}
