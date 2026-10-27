/**
 * `showcase/config.json` (PLAN §2.2): validated against `toolkit/schema/config.schema.json` by
 * the same interpreter as tours, then filled with defaults.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type JsonSchema, SchemaValidator } from "../runtime/src/schema.ts";
import configSchemaJson from "../schema/config.schema.json" with { type: "json" };

type Cmd = string | { url: string; method?: "GET" | "POST" | "PUT" | "DELETE" };

export interface Config {
  showcase: 1;
  app: { build?: string; start?: string; url: string; health?: string; env?: Record<string, string>; reset?: Cmd; snapshot?: Cmd };
  browser: {
    scale: number;
    viewport?: { width: number; height: number };
    colorScheme: "light" | "dark" | "no-preference";
    locale: string;
    timezone: string;
    clock?: { fixed: string };
    storageState?: string;
    gpu: "required" | "preferred";
    block: string[];
    hide: string[];
  };
  voice: {
    narrator?: { provider?: "openrouter" | "requesty"; model: string; voice: string; instructions?: string; speed?: number; approved?: string | false };
    draft: { provider: "say" | "fake"; voice?: string };
    /** The voices `voice --audition` tries instead of the built-in shortlist. */
    audition?: { id: string; provider?: "openrouter" | "requesty"; model: string; voice: string; instructions?: string }[];
    lexicon: Record<string, string>;
    dir: string;
    maxChars?: number;
  };
  film: { fps: 30; pointer: boolean; cards: boolean | CardsConfig; targetSec?: number; tolerance: number };
  privacy: { deny: (string | { pattern: string; flags?: string })[] };
}

/** `film.cards` as a brand (showcase 1.1). Paths are relative to the repo root. */
export interface CardsConfig {
  background: string;
  foreground: string;
  muted: string;
  accent: string;
  /** An SVG file drawn above the title. */
  mark?: string;
  fonts?: Partial<Record<"title" | "lines" | "kicker", { family: string; file: string }>>;
}

export const configSchema = configSchemaJson as JsonSchema;
const validator = new SchemaValidator(configSchema);

/** Fresh defaults each call, so no caller shares (and mutates) an array. */
export function defaults(): Pick<Config, "browser" | "voice" | "film" | "privacy"> {
  return {
    browser: { scale: 1.5, colorScheme: "light", locale: "en-GB", timezone: "Europe/London", gpu: "preferred", block: [], hide: [] },
    voice: { draft: { provider: "say" }, lexicon: {}, dir: "showcase/voice" },
    film: { fps: 30, pointer: true, cards: true, tolerance: 0.1 },
    privacy: { deny: [] },
  };
}

export class ConfigError extends Error {
  readonly problems: string[];
  constructor(file: string, problems: string[]) {
    super(`${file}: ${problems.length} problem${problems.length === 1 ? "" : "s"}\n${problems.map((p) => `  ${p}`).join("\n")}`);
    this.name = "ConfigError";
    this.problems = problems;
  }
}

/** Problems with a parsed config, as `<pointer>: <message>` lines; empty when it's valid. */
export function configProblems(value: unknown): string[] {
  return validator.validate(value).map((e) => `${e.path}: ${e.message}`);
}

/** A valid config with every default filled in. */
export function withDefaults(raw: Record<string, unknown>): Config {
  const d = defaults();
  const given = raw as unknown as Partial<Config>;
  return {
    ...(raw as unknown as Config),
    browser: { ...d.browser, ...given.browser },
    voice: { ...d.voice, ...given.voice, draft: { ...d.voice.draft, ...given.voice?.draft } },
    film: { ...d.film, ...given.film },
    privacy: { ...d.privacy, ...given.privacy },
  };
}

/** Reads `<showcaseDir>/config.json`; throws `ConfigError` with every problem. */
export function loadConfig(showcaseDir: string): Config {
  const file = join(showcaseDir, "config.json");
  if (!existsSync(file)) throw new ConfigError(file, ["missing: run `showcase init`"]);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    throw new ConfigError(file, [`not JSON: ${(e as Error).message}`]);
  }
  const problems = configProblems(raw);
  if (problems.length) throw new ConfigError(file, problems);
  return withDefaults(raw as Record<string, unknown>);
}
