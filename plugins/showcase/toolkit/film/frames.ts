/**
 * Where screencast frames go (PLAN §2.5 "Capture"): each JPEG is written to the capture dir
 * through a bounded queue. A frame is acknowledged at once while the queue has room; when it is
 * full, the acknowledgement waits for a write to finish, and Chrome drops frames (it sends the
 * next one only after the ack) instead of Node's memory growing. The main-thread capture and the
 * worker capture both use it.
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Frames waiting to be written before acknowledgements are held back (Spike 1 never saw 3). */
export const QUEUE_MAX = 120;

export interface FrameRecord {
  /** The file name in the capture dir. */
  file: string;
  /** The compositor's swap time, epoch milliseconds (`ScreencastFrameMetadata.timestamp` × 1000). */
  ts: number;
  bytes: number;
  /** The frame's device size. */
  w: number;
  h: number;
}

export interface SinkStats {
  frames: number;
  bytes: number;
  maxQueue: number;
  delayedAcks: number;
  writeErrors: number;
}

export interface FrameSink {
  /** Takes a frame (base64 JPEG); resolves when it may be acknowledged. */
  take(data: string, timestampSec: number | undefined): Promise<FrameRecord>;
  /** Resolves once every queued write has finished. */
  flush(): Promise<void>;
  readonly stats: SinkStats;
}

export interface SinkOptions {
  dir: string;
  /** Prefixes the file names, so two captures can share a dir. */
  prefix: string;
  queueMax?: number;
  /** What writes a file (a test slows it down). */
  write?: (file: string, data: Buffer) => Promise<void>;
  now?: () => number;
}

/** A JPEG's pixel size, from its start-of-frame marker. */
export function jpegSize(buf: Buffer): { w: number; h: number } | null {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1] ?? 0;
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}

export function createFrameSink(o: SinkOptions): FrameSink {
  const max = o.queueMax ?? QUEUE_MAX;
  const write = o.write ?? ((file, data) => writeFile(file, data));
  const now = o.now ?? Date.now;
  const stats: SinkStats = { frames: 0, bytes: 0, maxQueue: 0, delayedAcks: 0, writeErrors: 0 };
  let pending = 0;
  const waiters: (() => void)[] = [];
  const idle: (() => void)[] = [];
  let i = 0;

  return {
    stats,
    async take(data, timestampSec) {
      const buf = Buffer.from(data, "base64");
      const size = jpegSize(buf) ?? { w: 0, h: 0 };
      const file = `${o.prefix}${String(i++).padStart(6, "0")}.jpg`;
      const rec: FrameRecord = { file, ts: timestampSec ? timestampSec * 1000 : now(), bytes: buf.length, w: size.w, h: size.h };
      stats.frames += 1;
      stats.bytes += buf.length;
      pending += 1;
      stats.maxQueue = Math.max(stats.maxQueue, pending);
      write(join(o.dir, file), buf)
        .catch(() => {
          stats.writeErrors += 1;
        })
        .finally(() => {
          pending -= 1;
          waiters.shift()?.();
          if (pending === 0) for (const r of idle.splice(0)) r();
        });
      if (pending > max) {
        stats.delayedAcks += 1;
        await new Promise<void>((r) => waiters.push(r));
      }
      return rec;
    },
    flush: () => (pending === 0 ? Promise.resolve() : new Promise<void>((r) => idle.push(r))),
  };
}
