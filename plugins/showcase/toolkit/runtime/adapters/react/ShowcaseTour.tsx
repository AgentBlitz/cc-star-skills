/**
 * The showcase tour's React adapter, vendored by `showcase runtime vendor` (showcase {{version}}).
 * Generated: re-vendoring rewrites this file.
 *
 * Mount it once, near the root, with the app's router:
 * `<ShowcaseTour navigate={(url) => navigate(url)} />` (React Router's `useNavigate`, or any
 * function that changes the route without a page load). Without `navigate`, steps change pages
 * with a full load, and the tour resumes from the tab's sessionStorage. It renders nothing, and
 * it loads the runtime only when the URL has `?showcase=<id>` or a tour is part-way through.
 */
import { useEffect, useRef } from "react";
import type { Adapter } from "./runtime/showcase-runtime.mjs";

export interface ShowcaseTourProps extends Omit<Adapter, "navigate"> {
  /** Goes to a URL through the app's router. */
  navigate?: (url: string) => void | Promise<void>;
}

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

export function ShowcaseTour(props: ShowcaseTourProps): null {
  // The latest props, so a parent's re-render never restarts the tour.
  const latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    if (!wanted()) return;
    const { navigate, ...rest } = latest.current;
    import("./runtime/showcase-runtime.mjs")
      .then(({ startInApp }) =>
        startInApp({
          base: "{{base}}",
          ...rest,
          ...(navigate ? { navigate: (url: string) => (latest.current.navigate ?? navigate)(url) } : {}),
        }),
      )
      .catch((e: unknown) => console.warn("showcase:", e));
  }, []);
  return null;
}

export default ShowcaseTour;
