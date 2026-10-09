/**
 * The capture's fallback (PLAN §2.5 "Capture"): the screencast on a raw CDP WebSocket in a
 * worker thread, so a busy main event loop can't hold up acknowledgements. Chromium is launched
 * with `--remote-debugging-port` for it; the worker opens its own session on the page's target,
 * writes frames through the same bounded queue and reports each one to the main thread.
 */
import { parentPort, workerData } from "node:worker_threads";
import { createFrameSink } from "./frames.ts";

export interface WorkerData {
  url: string;
  dir: string;
  prefix: string;
  quality: number;
  maxWidth: number;
  maxHeight: number;
  queueMax?: number;
}

const d = workerData as WorkerData;
const port = parentPort;
if (!port) throw new Error("capture-worker runs as a worker thread");

const sink = createFrameSink({ dir: d.dir, prefix: d.prefix, ...(d.queueMax ? { queueMax: d.queueMax } : {}) });
const ws = new WebSocket(d.url);
let id = 0;
const replies = new Map<number, (msg: { error?: { message: string } }) => void>();
const send = (method: string, params: Record<string, unknown> = {}) =>
  new Promise<{ error?: { message: string } }>((resolve) => {
    const i = ++id;
    replies.set(i, resolve);
    ws.send(JSON.stringify({ id: i, method, params }));
  });

ws.addEventListener("message", (m) => {
  const msg = JSON.parse(String(m.data)) as { id?: number; method?: string; params?: { data: string; sessionId: number; metadata: { timestamp?: number } }; error?: { message: string } };
  if (msg.id !== undefined) {
    replies.get(msg.id)?.(msg);
    replies.delete(msg.id);
    return;
  }
  if (msg.method !== "Page.screencastFrame" || !msg.params) return;
  const { data, sessionId, metadata } = msg.params;
  void sink.take(data, metadata.timestamp).then((rec) => {
    ws.send(JSON.stringify({ id: ++id, method: "Page.screencastFrameAck", params: { sessionId } }));
    port.postMessage({ type: "frame", rec });
  });
});
ws.addEventListener("error", () => port.postMessage({ type: "error", message: `the capture worker's socket failed (${d.url})` }));
ws.addEventListener("open", () => {
  void send("Page.startScreencast", { format: "jpeg", quality: d.quality, maxWidth: d.maxWidth, maxHeight: d.maxHeight, everyNthFrame: 1 }).then((r) => {
    if (r.error) port.postMessage({ type: "error", message: `Page.startScreencast: ${r.error.message}` });
    else port.postMessage({ type: "started" });
  });
});

port.on("message", (msg: { type: string }) => {
  if (msg.type !== "stop") return;
  void (async () => {
    if (ws.readyState === WebSocket.OPEN) await send("Page.stopScreencast").catch(() => null);
    await sink.flush();
    ws.close();
    port.postMessage({ type: "stopped", stats: sink.stats });
  })();
});
