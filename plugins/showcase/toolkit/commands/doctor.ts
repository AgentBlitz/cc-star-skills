/**
 * `showcase doctor`: the capability matrix (PLAN §2.2). Required checks fail the command; the
 * rest are informational. `--install --yes` puts playwright-core (and Chromium, if missing)
 * into the cache.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { toolEnv } from "../lib/child-env.ts";
import { resolveAll } from "../lib/env.ts";
import { findFfmpeg, missing, probeCapabilities } from "../lib/ffmpeg.ts";
import { PW_VERSION, chromium, findPlaywright, install, installChromium, pwCacheDir } from "../lib/playwright.ts";
import { pluginRoot } from "../lib/paths.ts";
import type { Command } from "./types.ts";

export interface Check {
  id: string;
  ok: boolean;
  required: boolean;
  detail: string;
  data?: unknown;
}

function sayVoices(): { available: boolean; enGB: string[] } {
  try {
    const out = execFileSync("say", ["-v", "?"], { env: toolEnv(), stdio: ["ignore", "pipe", "ignore"] }).toString();
    const enGB = out
      .split("\n")
      .map((l) => /^(.+?)\s+en_GB\s/.exec(l)?.[1]?.trim())
      .filter((v): v is string => Boolean(v));
    return { available: true, enGB };
  } catch {
    return { available: false, enGB: [] };
  }
}

function planningPlugin(): string | null {
  const cache = join(process.env.HOME || homedir(), ".claude", "plugins", "cache");
  if (existsSync(cache)) {
    for (const market of readdirSync(cache)) {
      const dir = join(cache, market, "planning");
      if (existsSync(dir) && readdirSync(dir).length) return `installed (${market})`;
    }
  }
  if (existsSync(join(pluginRoot, "..", "planning", ".claude-plugin", "plugin.json"))) return "dev checkout (sibling plugin)";
  return null;
}

export async function runChecks(): Promise<Check[]> {
  const checks: Check[] = [];
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  const ts = process.features.typescript;
  checks.push({
    id: "node",
    ok: nodeMajor >= 24 && Boolean(ts),
    required: true,
    detail: `Node ${process.versions.node}, TypeScript ${ts || "off"}`,
  });

  const ff = findFfmpeg();
  checks.push({ id: "ffprobe", ok: Boolean(ff.ffprobe), required: true, detail: ff.ffprobe ?? "not found (brew install ffmpeg)" });
  if (ff.ffmpeg) {
    const probe = probeCapabilities(ff.ffmpeg);
    const gaps = missing(probe);
    checks.push({
      id: "ffmpeg",
      ok: gaps.length === 0,
      required: true,
      detail: `${ff.ffmpeg} (${probe.version ?? "unknown version"})${gaps.length ? `; missing: ${gaps.join(", ")}` : "; all capabilities present"}`,
      data: probe,
    });
  } else {
    checks.push({ id: "ffmpeg", ok: false, required: true, detail: "not found (brew install ffmpeg, or set FFMPEG_PATH)" });
  }

  const pw = findPlaywright();
  checks.push({
    id: "playwright-core",
    ok: Boolean(pw && pw.version === PW_VERSION),
    required: true,
    detail: pw
      ? `${pw.version} from ${pw.source} (${pw.dir})${pw.version === PW_VERSION ? "" : `; need ${PW_VERSION}`}`
      : `not found; run 'showcase doctor --install --yes' to install it into ${pwCacheDir()}`,
    ...(pw ? { data: pw } : {}),
  });
  if (pw) {
    const c = await chromium(pw);
    checks.push({
      id: "chromium",
      ok: c.exists,
      required: true,
      detail: c.exists
        ? `build ${c.revision ?? "?"} at ${c.path}`
        : `build ${c.revision ?? "?"} missing; run 'showcase doctor --install --yes'`,
      data: c,
    });
  } else {
    const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    checks.push({
      id: "chromium",
      ok: false,
      required: true,
      detail: existsSync(chrome) ? `needs playwright-core first (Google Chrome is installed as a fallback)` : "needs playwright-core first",
    });
  }

  const say = sayVoices();
  checks.push({
    id: "say",
    ok: say.available && say.enGB.length > 0,
    required: false,
    detail: say.available
      ? say.enGB.length
        ? `en-GB voices: ${say.enGB.slice(0, 5).join(", ")}${say.enGB.length > 5 ? ` (+${say.enGB.length - 5})` : ""}`
        : "no en-GB voice installed (System Settings › Accessibility › Spoken Content)"
      : "not available (macOS only); drafts fall back to the fake voice",
    data: say,
  });

  const { values, files } = resolveAll();
  const key = values.find((v) => v.name === "OPENROUTER_API_KEY");
  checks.push({
    id: "keys",
    ok: Boolean(key?.source),
    required: false,
    detail: key?.source
      ? `OPENROUTER_API_KEY set (${key.source})`
      : `OPENROUTER_API_KEY unset; user file ${files.user.state}${files.user.fix ? ` (fix: ${files.user.fix})` : ""}. The draft voice still works.`,
    data: {
      keys: values.map((v) => ({ name: v.name, set: Boolean(v.source), source: v.source })),
      userFile: files.user,
      repoFile: files.repo,
    },
  });

  const planning = planningPlugin();
  checks.push({ id: "planning", ok: Boolean(planning), required: false, detail: planning ?? "not installed (needed for the /planning:roadmap hand-off)" });

  const os = platform();
  checks.push({
    id: "platform",
    ok: true,
    required: false,
    detail:
      os === "darwin"
        ? "macOS: say drafts available; Homebrew ffmpeg expected"
        : os === "linux"
          ? "Linux: no say, so drafts use the fake voice; install ffmpeg with libass and soxr"
          : `${os}: untested; WSL or Linux recommended`,
  });
  return checks;
}

export const doctor: Command = {
  name: "doctor",
  summary: "Check prerequisites: Node, ffmpeg, playwright-core, Chromium, say, keys",
  usage: [
    "Usage: showcase doctor [--json] [--install [--yes]]",
    "  --install  install playwright-core (and Chromium, if missing) into the cache; needs --yes",
  ].join("\n"),
  options: { install: { type: "boolean" }, yes: { type: "boolean" } },
  async run({ values, log }) {
    if (values.install) {
      let pw = findPlaywright();
      const needPw = !pw || pw.version !== PW_VERSION;
      const needChromium = pw ? !(await chromium(pw)).exists : true;
      if (!needPw && !needChromium) log.info(`playwright-core ${PW_VERSION} and Chromium already present.`);
      else if (!values.yes) {
        log.warn(
          `Would install${needPw ? ` playwright-core@${PW_VERSION} into ${pwCacheDir()}` : ""}${needPw && needChromium ? " and" : ""}${needChromium ? " Chromium" : ""}. Re-run with --yes.`,
        );
        return 1;
      } else {
        if (needPw) pw = install();
        if (pw && !(await chromium(pw)).exists) installChromium(pw);
      }
    }
    const checks = await runChecks();
    const ok = checks.every((c) => c.ok || !c.required);
    log.result({ ok, checks }, () => [
      ...checks.map((c) => `${c.ok ? "ok  " : c.required ? "FAIL" : "warn"}  ${c.id.padEnd(15)} ${c.detail}`),
      ok ? "All required capabilities present." : "Some required capabilities are missing.",
    ]);
    return ok ? 0 : 1;
  },
};
