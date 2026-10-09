/** `showcase docs [topic]`: the skill's reference docs, for sessions and terminals (PLAN D18). */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pluginRoot } from "../lib/paths.ts";
import type { Command } from "./types.ts";

export const referenceDir = join(pluginRoot, "skills", "showcase", "reference");

function topics(): string[] {
  if (!existsSync(referenceDir)) return [];
  return readdirSync(referenceDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.slice(0, -3))
    .sort();
}

export const docs: Command = {
  name: "docs",
  summary: "List or print the skill's reference docs",
  usage: "Usage: showcase docs [topic] [--json]\n  With no topic, lists the topics. With one, prints skills/showcase/reference/<topic>.md.",
  allowPositionals: true,
  async run({ positionals, log }) {
    const all = topics();
    const [topic] = positionals;
    if (!topic) {
      log.result({ topics: all }, () => (all.length ? ["Reference docs:", ...all.map((t) => `  ${t}`)] : "No reference docs yet."));
      return 0;
    }
    if (!all.includes(topic)) {
      log.warn(all.length ? `No doc '${topic}'. Topics: ${all.join(", ")}` : "No reference docs yet.");
      return 1;
    }
    const text = readFileSync(join(referenceDir, `${topic}.md`), "utf8");
    log.result({ topic, text }, () => text.trimEnd());
    return 0;
  },
};
