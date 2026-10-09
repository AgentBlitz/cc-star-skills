/**
 * The capture (PLAN §2.5 "Capture", S-D1): CDP `Page.startScreencast`, JPEG at S-D1's quality,
 * `maxWidth` 1920 and `maxHeight` 1080, every frame, acknowledged at once and written through the
 * bounded queue (`frames.ts`). It runs on the main thread, where Spike 1 measured an event-loop
 * p99 of 11.7 ms; if a one-second window's p99 goes over 20 ms, the capture moves to a worker on
 * a raw CDP WebSocket (`capture-worker.ts`): the worker's screencast starts, and the main one
 * stops once the worker has its first frame, so nothing is missed in between.
 *
 * It also tells the recorder when the screen has gone still (no new frames for a while), which
 * is how a film is armed.
 */
import { monitorEventLoopDelay } from "node:perf_hooks";
import { Worker } from "node:worker_threads";
import type { BrowserContext, CDPSession, Page } from "playwright-core";
import { createFrameSink, type FrameRecord, type SinkStats } from "./frames.ts";
import type { WorkerData } from "./capture-worker.ts";

/** S-D1: JPEG q90. */
export const JPEG_QUALITY = 90;
/** The event-loop p99 above which capture moves to the worker. */
export const LAG_LIMIT_MS = 20;

export type CaptureMode = "auto" | "main" | "worker";

export interface CaptureOptions {
  page: Page;
  context: BrowserContext;
  dir: string;
  mode?: CaptureMode;
  quality?: number;
  /** Chromium's `--remote-debugging-port`, which the worker needs. */
  debugPort?: number | null;
  lagLimitMs?: number;
  say?: (line: string) => void;
}

export interface CaptureStats {
  /** Where frames came from: the main thread, the worker, or the main thread then the worker. */
  mode: "main" | "worker" | "main→worker";
  /** When the worker took over (epoch ms), if it did. */
  switchedAt: number | null;
  frames: number;
  bytes: number;
  maxQueue: number;
  delayedAcks: number;
  writeErrors: number;
  /** Event-loop delay p99 over the monitored time, and the worst one-second window. */
  eventLoopP99Ms: number | null;
  eventLoopWorstMs: number | null;
}

export interface Capture {
  /** Every frame so far, by timestamp. */
  frames(): FrameRecord[];
  /** Resolves when no frame has come for `ms` (true), or after `capMs` regardless (false). */
  quiet(ms: number, capMs: number): Promise<boolean>;
  /** Starts watching the event loop (from the pre-roll): the worker fallback's trigger. */
  monitor(): void;
  stop(): Promise<CaptureStats>;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

async function targetUrl(cdp: CDPSession, port: number): Promise<string> {
  const { targetInfo } = await cdp.send("Target.getTargetInfo");
  const list = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as { id: string; webSocketDebuggerUrl?: string }[];
  const url = list.find((t) => t.id === targetInfo.targetId)?.webSocketDebuggerUrl;
  if (!url) throw new Error(`no DevTools socket for the page (target ${targetInfo.targetId})`);
  return url;
}

export async function startCapture(o: CaptureOptions): Promise<Capture> {
  const quality = o.quality ?? JPEG_QUALITY;
  const mode = o.mode ?? "auto";
  const say = o.say ?? (() => {});
  const lagLimit = o.lagLimitMs ?? LAG_LIMIT_MS;
  const screencast = { format: "jpeg" as const, quality, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 };
  const all: FrameRecord[] = [];
  let lastArrival = Date.now();
  const got = (rec: FrameRecord) => {
    all.push(rec);
    lastArrival = Date.now();
  };

  const cdp = await o.context.newCDPSession(o.page);
  const main = createFrameSink({ dir: o.dir, prefix: "m" });
  let mainOn = false;
  let worker: { w: Worker; stats: SinkStats | null; stopped: Promise<void> } | null = null;
  let switchedAt: number | null = null;
  let workerError: string | null = null;

  const startMain = async () => {
    cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
      void main.take(data, metadata.timestamp).then((rec) => {
        cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
        got(rec);
      });
    });
    await cdp.send("Page.startScreencast", screencast);
    mainOn = true;
  };
  const stopMain = async () => {
    if (!mainOn) return;
    mainOn = false;
    await cdp.send("Page.stopScreencast").catch(() => {});
  };

  const startWorker = async (): Promise<void> => {
    if (!o.debugPort) throw new Error("the worker capture needs Chromium's --remote-debugging-port");
    const url = await targetUrl(cdp, o.debugPort);
    const data: WorkerData = { url, dir: o.dir, prefix: "w", quality, maxWidth: screencast.maxWidth, maxHeight: screencast.maxHeight };
    const w = new Worker(new URL("./capture-worker.ts", import.meta.url), { workerData: data });
    let stoppedResolve = () => {};
    const handle = {
      w,
      stats: null as SinkStats | null,
      stopped: new Promise<void>((r) => {
        stoppedResolve = r;
      }),
    };
    worker = handle;
    let first: () => void = () => {};
    const firstFrame = new Promise<void>((r) => {
      first = r;
    });
    w.on("message", (msg: { type: string; rec?: FrameRecord; stats?: SinkStats; message?: string }) => {
      if (msg.type === "frame" && msg.rec) {
        got(msg.rec);
        first();
      } else if (msg.type === "stopped") {
        handle.stats = msg.stats ?? null;
        stoppedResolve();
      } else if (msg.type === "error") {
        workerError = msg.message ?? "the capture worker failed";
        first();
      }
    });
    w.on("error", (e) => {
      workerError = e.message;
      first();
      stoppedResolve();
    });
    w.on("exit", () => stoppedResolve());
    await Promise.race([firstFrame, new Promise((r) => setTimeout(r, 5_000))]);
    if (workerError) throw new Error(workerError);
  };

  if (mode === "worker") {
    await startWorker();
  } else {
    await startMain();
  }

  // The event loop, in one-second windows.
  const overall = monitorEventLoopDelay({ resolution: 10 });
  const second = monitorEventLoopDelay({ resolution: 10 });
  let worst = 0;
  let timer: NodeJS.Timeout | null = null;
  let monitored = false;
  const check = () => {
    const p99 = second.percentile(99) / 1e6;
    second.reset();
    worst = Math.max(worst, p99);
    if (mode !== "auto" || worker || !mainOn || p99 <= lagLimit) return;
    switchedAt = Date.now();
    say(`the event loop lagged (p99 ${round1(p99)} ms): capture moves to a worker`);
    void startWorker().then(
      () => stopMain(),
      (e: Error) => say(`the capture worker didn't start (${e.message}); staying on the main thread`),
    );
  };

  return {
    frames: () => [...all].sort((a, b) => a.ts - b.ts),
    quiet: (ms, capMs) =>
      new Promise((resolve) => {
        const t0 = Date.now();
        const tick = () => {
          const now = Date.now();
          if (now - lastArrival >= ms) return resolve(true);
          if (now - t0 >= capMs) return resolve(false);
          setTimeout(tick, 20);
        };
        tick();
      }),
    monitor: () => {
      if (monitored) return;
      monitored = true;
      overall.enable();
      second.enable();
      timer = setInterval(check, 1_000);
    },
    stop: async () => {
      if (timer) clearInterval(timer);
      overall.disable();
      second.disable();
      await stopMain();
      await main.flush();
      const w = worker as { w: Worker; stats: SinkStats | null; stopped: Promise<void> } | null;
      if (w) {
        w.w.postMessage({ type: "stop" });
        await Promise.race([w.stopped, new Promise((r) => setTimeout(r, 10_000))]);
        await w.w.terminate();
      }
      await cdp.detach().catch(() => {});
      const ws = w?.stats ?? { frames: 0, bytes: 0, maxQueue: 0, delayedAcks: 0, writeErrors: 0 };
      const ms = main.stats;
      return {
        mode: w ? (ms.frames > 0 ? "main→worker" : "worker") : "main",
        switchedAt,
        frames: ms.frames + ws.frames,
        bytes: ms.bytes + ws.bytes,
        maxQueue: Math.max(ms.maxQueue, ws.maxQueue),
        delayedAcks: ms.delayedAcks + ws.delayedAcks,
        writeErrors: ms.writeErrors + ws.writeErrors,
        eventLoopP99Ms: monitored ? round1(overall.percentile(99) / 1e6) : null,
        eventLoopWorstMs: monitored ? round1(worst) : null,
      };
    },
  };
}
