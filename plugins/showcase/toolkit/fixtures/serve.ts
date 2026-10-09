/**
 * The fixture app's server (PLAN §5 Session 2): zero dependencies, `node:http`, its own port.
 * It serves `fixtures/app/`, sends `/spa/*` to `spa.html` (the History-API route), and can add
 * latency to documents and stylesheets, so page loads behave like a real app's.
 *
 *   node toolkit/fixtures/serve.ts [--port 4600] [--latency 120]
 */
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize, resolve, sep } from "node:path";
import { parseArgs } from "node:util";

export const APP_DIR = resolve(import.meta.dirname, "app");

/** The fixture's pages, each loaded by the gate's console-error check. */
export const PAGES = ["index.html", "list.html", "detail.html", "spa.html", "spa/settings", "frame.html"] as const;

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

export interface FixtureServer {
  url: string;
  port: number;
  server: Server;
  close(): Promise<void>;
}

export interface ServeOptions {
  port?: number;
  /** Delay before each `.html` and `.css` response, in ms. */
  latencyMs?: number;
}

function resolvePath(urlPath: string): string | null {
  let p = decodeURIComponent(urlPath.split("?")[0] ?? "/");
  if (p === "/") p = "/index.html";
  if (p === "/spa" || p.startsWith("/spa/")) p = "/spa.html";
  const file = normalize(join(APP_DIR, p));
  return file.startsWith(APP_DIR + sep) ? file : null;
}

export function serveFixture(opts: ServeOptions = {}): Promise<FixtureServer> {
  const latency = opts.latencyMs ?? 0;
  const server = createServer(async (req, res) => {
    const file = resolvePath(req.url ?? "/");
    if (req.url === "/favicon.ico") {
      res.writeHead(204).end();
      return;
    }
    if (!file) {
      res.writeHead(400).end("bad path");
      return;
    }
    try {
      const body = await readFile(file);
      const type = TYPES[extname(file)] ?? "application/octet-stream";
      if (latency > 0 && (type.startsWith("text/html") || type.startsWith("text/css"))) {
        await new Promise((r) => setTimeout(r, latency));
      }
      res.writeHead(200, { "content-type": type, "cache-control": "no-store" }).end(body);
    } catch {
      res.writeHead(404, { "content-type": "text/plain" }).end("not found");
    }
  });
  return new Promise((done, fail) => {
    server.once("error", fail);
    server.listen(opts.port ?? 0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      done({
        url: `http://127.0.0.1:${port}`,
        port,
        server,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: { port: { type: "string", default: "4600" }, latency: { type: "string", default: "0" } },
  });
  const s = await serveFixture({ port: Number(values.port), latencyMs: Number(values.latency) });
  process.stdout.write(`fixture app: ${s.url}/\n`);
}
