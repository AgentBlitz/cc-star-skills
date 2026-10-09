/**
 * `showcase inspect <url>` (PLAN §2.2): a page outlined by role and name, with the anchor to use
 * for each element (`runtime/src/inspect.ts` does the work in the page). A path is opened on the
 * repo's app, brought up as for a rehearsal; a full URL is opened as it is.
 */
import { join } from "node:path";
import type { OutlineItem } from "../runtime/src/protocol.ts";
import { type Host, launchHost } from "./launch.ts";
import { appUrl, browserSettings, openSession, type Project } from "./project.ts";

export interface InspectReport {
  url: string;
  title: string;
  items: OutlineItem[];
}

export interface InspectOptions {
  project: Project;
  target: string;
  hidden?: boolean;
  limit?: number;
  build?: boolean;
  reset?: boolean;
  /** An app already running, for a path target. */
  url?: string;
  marker?: string;
  say?: (line: string) => void;
}

export async function inspect(o: InspectOptions): Promise<InspectReport> {
  const absolute = /^https?:\/\//.test(o.target);
  const session = absolute
    ? null
    : await openSession(o.project, {
        what: "inspect",
        ...(o.url ? { url: o.url } : {}),
        ...(o.build ? { build: true } : {}),
        reset: o.reset ?? false,
        ...(o.project.showcaseDir ? { logFile: join(o.project.showcaseDir, ".cache", "app.log") } : {}),
        ...(o.say ? { say: o.say } : {}),
      });
  let host: Host | null = null;
  session?.onStop(async () => {
    await host?.close();
  });
  try {
    const url = absolute ? o.target : appUrl((session as NonNullable<typeof session>).app.url, o.target);
    host = await launchHost({ url, tour: null, mode: "watch", headless: true, browser: browserSettings(o.project), ...(o.marker ? { marker: o.marker } : {}) });
    await host.page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    const items = (await host.page.evaluate(`__showcase.inspect(${JSON.stringify({ hidden: !!o.hidden, limit: o.limit ?? 400 })})`)) as OutlineItem[];
    return { url: host.page.url(), title: await host.page.title(), items };
  } finally {
    await host?.close();
    await session?.close();
  }
}

/** The outline as lines: indented role and name, then the suggested anchor. */
export function outlineLines(r: InspectReport): string[] {
  const lines = [`${r.title || "(untitled)"} · ${r.url}`];
  for (const i of r.items) {
    const head = `${"  ".repeat(i.depth)}${i.role}${i.level ? ` ${i.level}` : ""}${i.name ? ` "${i.name}"` : ""}${i.visible ? "" : " (hidden)"}`;
    lines.push(i.anchor ? `${head.padEnd(56)}  ${JSON.stringify(i.anchor)}` : `${head}  (no unique anchor)`);
  }
  return lines;
}
