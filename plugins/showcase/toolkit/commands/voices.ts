/** `showcase voices --list`: the public speech catalogues, OpenRouter's and Requesty's (PLAN §2.4). No key needed. */
import { fetchCatalogue, fetchRequestyCatalogue, offered, type SpeechModel } from "../voice/catalogue.ts";
import { SHORTLIST } from "../voice/audition.ts";
import { type Command, UsageError } from "./types.ts";

export const voices: Command = {
  name: "voices",
  summary: "List the speech models and voices OpenRouter and Requesty offer (no key needed)",
  usage: [
    "Usage: showcase voices --list [--model <id>] [--json]",
    "  --list         every speech model with its voice count, and which shortlisted voices it offers",
    "  --model <id>   that model's voices",
  ].join("\n"),
  options: { list: { type: "boolean" }, model: { type: "string" } },
  async run({ values, log }) {
    if (!values.list && typeof values.model !== "string") throw new UsageError("pass --list");
    const catalogue = await fetchCatalogue();
    const requesty = await fetchRequestyCatalogue().catch((e: Error): SpeechModel[] | null => {
      log.warn(`showcase voices: ${e.message}; listing OpenRouter's only`);
      return null;
    });
    if (typeof values.model === "string") {
      const m = catalogue.find((x) => x.id === values.model) ?? requesty?.find((x) => x.id === values.model);
      if (!m) {
        log.warn(`showcase voices: no speech model '${values.model}'. Run 'showcase voices --list'.`);
        return 1;
      }
      log.result(m, () => [`${m.id} (${m.name})`, m.voices.length ? m.voices.join("\n") : "(the catalogue lists no voices for this model)"]);
      return 0;
    }
    const shortlist = SHORTLIST.map((c) => {
      const provider = c.provider ?? "openrouter";
      const listed = provider === "requesty" ? requesty : catalogue;
      return { id: c.id, provider, model: c.model, voice: c.voice, offered: listed ? offered(listed, c.model, c.voice).voice : null };
    });
    const row = (m: SpeechModel) => `${m.id.padEnd(42)} ${String(m.voices.length).padStart(3)} voices  ${m.name}`;
    log.result({ models: catalogue, requesty, shortlist }, () => [
      `OpenRouter lists ${catalogue.length} speech models.`,
      "",
      ...catalogue.map(row),
      "",
      ...(requesty ? [`Requesty lists ${requesty.length} speech models.`, "", ...requesty.map(row), ""] : []),
      "Shortlist (showcase voice <tour> --audition):",
      ...shortlist.map(
        (s) => `  ${s.offered === null ? "?" : s.offered ? "✓" : "✗"} ${s.id.padEnd(20)} ${s.provider} · ${s.model} · ${s.voice}${s.offered === false ? "  — not offered" : s.offered === null ? "  — catalogue unavailable" : ""}`,
      ),
    ]);
    return 0;
  },
};
