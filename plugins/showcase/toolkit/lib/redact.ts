/**
 * Secret hygiene (PLAN §2.3, C1), ported from gods-eye's `src/core/ai/redact.ts`. Every value
 * `env.ts` loads is registered here, and everything showcase prints passes through `redact()`.
 */
import { SECRET_NAMES } from "./names.ts";

const BEARER = /\b(Bearer)\s+[A-Za-z0-9._~+/=-]+/gi;
const AUTH_HEADER = /("?authorization"?\s*[:=]\s*"?)([^",}\n]+)/gi;
const KEY_PARAM = /\b(api[_-]?key|key|token)=([^&\s"]+)/gi;

const loaded = new Set<string>();

/** Remember a secret value so `redact()` masks it wherever it turns up. */
export function registerSecret(value: string | undefined): void {
  if (value && value.length >= 6) loaded.add(value);
}

export function redact(text: string, secrets: readonly (string | undefined | null)[] = []): string {
  let out = text;
  const envSecrets = SECRET_NAMES.map((n) => process.env[n]);
  for (const s of [...secrets, ...loaded, ...envSecrets]) {
    if (s && s.length >= 6) out = out.split(s).join("[redacted]");
  }
  return out
    .replace(BEARER, "$1 [redacted]")
    .replace(AUTH_HEADER, "$1[redacted]")
    .replace(KEY_PARAM, "$1=[redacted]");
}

/** A safe one-line description of an error: its name, status and redacted message. */
export function describeError(e: unknown): string {
  if (!(e instanceof Error)) return redact(String(e)).slice(0, 300);
  const status = (e as { statusCode?: number; status?: number }).statusCode ?? (e as { status?: number }).status;
  return redact(`${e.name}${status ? ` ${status}` : ""}: ${e.message}`).slice(0, 300);
}
