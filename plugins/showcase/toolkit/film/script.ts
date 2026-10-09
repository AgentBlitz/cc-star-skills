/**
 * The film's text sidecars (PLAN §2.5 "Outputs"), from the take's spans. Pure.
 *
 * - **Chapters:** one per beat, as an ffmetadata file the master mux reads (`-map_chapters`).
 *   A chapter runs from its beat's start to the next beat's (the last to the video's end), so
 *   the chapters tile the film with no holes.
 * - **`script.md`:** the film as read: a header (tour, length, voice, draft or not), then each
 *   beat with its timecode and a table of its sentences (timecode, text, duration) and the time
 *   the screen held with nothing said.
 */
import type { BeatSpan, SentenceSpan } from "./timeline.ts";

/** `M:SS.s`, the script's clock. */
export function timecode(ms: number): string {
  const t = Math.max(0, Math.round(ms / 100));
  const m = Math.floor(t / 600);
  const s = (t % 600) / 10;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

function metaEscape(s: string): string {
  return s.replace(/[=;#\\\n]/g, (c) => (c === "\n" ? " " : `\\${c}`));
}

export function chaptersMeta(beats: readonly BeatSpan[], durationMs: number, title?: string): string {
  const lines = [";FFMETADATA1"];
  if (title) lines.push(`title=${metaEscape(title)}`);
  beats.forEach((b, i) => {
    const start = Math.max(0, Math.round(b.startMs));
    const end = Math.max(start + 1, Math.round(beats[i + 1]?.startMs ?? durationMs));
    lines.push("", "[CHAPTER]", "TIMEBASE=1/1000", `START=${start}`, `END=${end}`, `title=${metaEscape(`${String(i + 1).padStart(2, "0")} ${b.title ? `${b.title} · ` : ""}${b.beat}`)}`);
  });
  return `${lines.join("\n")}\n`;
}

export interface ScriptHeader {
  tour: string;
  title: string;
  durationMs: number;
  /** Who speaks: "the narrator (…)" or "the draft voice (say)". */
  voice: string;
  draft: boolean;
  video: string;
  at: string;
}

function cell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function scriptMd(h: ScriptHeader, beats: readonly BeatSpan[], sentences: readonly SentenceSpan[]): string {
  const out = [
    `# ${h.title}`,
    "",
    `- **Tour:** \`${h.tour}\``,
    `- **Length:** ${timecode(h.durationMs)} (${(h.durationMs / 1000).toFixed(1)} s), ${beats.length} beats, ${sentences.length} sentences`,
    `- **Voice:** ${h.voice}${h.draft ? " — **draft** (watermarked)" : ""}`,
    `- **Video:** \`${h.video}\``,
    `- **Filmed:** ${h.at}`,
    "",
  ];
  beats.forEach((b, i) => {
    const own = sentences.filter((s) => s.beat === b.beat);
    const spoken = own.reduce((n, s) => n + (s.endMs - s.startMs), 0);
    out.push(
      `## ${String(i + 1).padStart(2, "0")} · ${b.beat}${b.title ? ` — ${b.title}` : ""}`,
      "",
      `${timecode(b.startMs)}–${timecode(b.endMs)} · ${b.kind} · ${((b.endMs - b.startMs) / 1000).toFixed(1)} s, ${(spoken / 1000).toFixed(1)} s spoken, ${(Math.max(0, b.endMs - b.startMs - spoken) / 1000).toFixed(1)} s held`,
      "",
    );
    if (own.length === 0) out.push("_No narration._", "");
    else {
      out.push("| At | Sentence | Sec |", "|---|---|---|");
      for (const s of own) out.push(`| ${timecode(s.startMs)} | ${cell(s.text)}${s.audio ? "" : " _(no clip: reading time)_"} | ${((s.endMs - s.startMs) / 1000).toFixed(1)} |`);
      out.push("");
    }
  });
  return out.join("\n");
}
