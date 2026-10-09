/** `showcase voices --list`: the public speech catalogue (PLAN §2.4). No key needed. */
import { offered, fetchCatalogue } from "../voice/catalogue.ts";
import { SHORTLIST } from "../voice/audition.ts";
import { type Command, UsageError } from "./types.ts";

export const voices: Command = {
  name: "voices",
  summary: "List the speech models and voices OpenRouter offers (no key needed)",
  usage: [
    "Usage: showcase voices --list [--model <id>] [--json]",
    "  --list         every speech model with its voice count, and which shortlisted voices it offers",
    "  --model <id>   that model's voices",
  ].join("\n"),
  options: { list: { type: "boolean" }, model: { type: "string" } },
  async run({ values, log }) {
    if (!values.list && typeof values.model !== "string") throw new UsageError("pass --list");
    const catalogue = await fetchCatalogue();
    if (typeof values.model === "string") {
      const m = catalogue.find((x) => x.id === values.model);
      if (!m) {
        log.warn(`showcase voices: no speech model '${values.model}'. Run 'showcase voices --list'.`);
        return 1;
      }
      log.result(m, () => [`${m.id} (${m.name})`, m.voices.length ? m.voices.join("\n") : "(the catalogue lists no voices for this model)"]);
      return 0;
    }
    const shortlist = SHORTLIST.map((c) => ({ id: c.id, model: c.model, voice: c.voice, offered: offered(catalogue, c.model, c.voice).voice }));
    log.result({ models: catalogue, shortlist }, () => [
      `OpenRouter lists ${catalogue.length} speech models.`,
      "",
      ...catalogue.map((m) => `${m.id.padEnd(42)} ${String(m.voices.length).padStart(3)} voices  ${m.name}`),
      "",
      "British shortlist (showcase voice <tour> --audition):",
      ...shortlist.map((s) => `  ${s.offered ? "✓" : "✗"} ${s.id.padEnd(20)} ${s.model} · ${s.voice}${s.offered ? "" : "  — not offered"}`),
    ]);
    return 0;
  },
};
