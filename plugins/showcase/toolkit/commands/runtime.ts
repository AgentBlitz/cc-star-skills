/**
 * `showcase runtime vendor` (PLAN §2.2, §2.6): puts the runtime and an adapter inside the app,
 * publishes the tours beside the voice, and points `voice.dir` there. Idempotent and
 * version-stamped (`lib/vendor.ts`).
 */
import { FRAMEWORKS, type Framework, vendor } from "../lib/vendor.ts";
import { repoRoot } from "../lib/paths.ts";
import { type Command, UsageError } from "./types.ts";

export const runtime: Command = {
  name: "runtime",
  summary: "Vendor the tour runtime into the app for an in-app tour (Next, React or plain HTML)",
  usage: [
    "Usage: showcase runtime vendor [--framework next|react|html] [--to <dir>] [--public <dir>] [--json]",
    "  Copies the runtime (showcase-runtime.mjs and its types, version-stamped) into <to>/runtime/",
    "  and writes the adapter: Next, a client component ShowcaseTour.tsx on next/navigation (and",
    "  showcase-adapter.ts, yours to edit, written once); React, a ShowcaseTour.tsx with a navigate",
    "  prop; HTML, a <script type=\"module\"> snippet for each page. Publishes showcase/tours/ to",
    "  <public>/showcase/tours/ and sets voice.dir to <public>/showcase/voice/. Run it again after",
    "  editing a tour; a second run with nothing new changes nothing.",
    "  --framework <f>  next (default), react or html",
    "  --to <dir>       where the runtime and adapter go (default src/showcase, else",
    "                   components/showcase; for HTML, <public>/showcase)",
    "  --public <dir>   the app's static root (default public; for HTML without one, the repo root)",
  ].join("\n"),
  options: { framework: { type: "string" }, to: { type: "string" }, public: { type: "string" } },
  allowPositionals: true,
  async run({ positionals, values, log }) {
    if (positionals[0] !== "vendor" || positionals.length !== 1) throw new UsageError("the subcommand is `vendor`");
    const framework = (values.framework ?? "next") as Framework;
    if (!FRAMEWORKS.includes(framework)) throw new UsageError(`--framework must be one of ${FRAMEWORKS.join(", ")}`);
    const root = repoRoot() ?? process.cwd();
    const r = vendor({
      root,
      framework,
      ...(typeof values.to === "string" ? { to: values.to } : {}),
      ...(typeof values.public === "string" ? { publicDir: values.public } : {}),
    });
    const changed = r.changes.filter((c) => c.did !== "unchanged" && c.did !== "kept");
    log.result({ ...r, changed: changed.length > 0 }, () => [
      ...(changed.length ? changed.map((c) => `${c.did.padEnd(9)} ${c.path}`) : [`runtime ${r.version} is already vendored for ${framework}: nothing changed`]),
      `tours served: ${r.tours.length ? r.tours.map((t) => `/showcase/tours/${t}.json`).join(", ") : "none yet"}`,
      ...(framework === "next" ? ["mount <ShowcaseTour /> once in the root layout; start a tour with ?showcase=<id>"] : []),
      ...(framework === "react" ? ["mount <ShowcaseTour navigate={…} /> once near the root; start a tour with ?showcase=<id>"] : []),
      ...(r.snippet ? ["put this in every page's <head>:", r.snippet.trimEnd()] : []),
    ]);
    return 0;
  },
};
