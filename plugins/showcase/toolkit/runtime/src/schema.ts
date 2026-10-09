/**
 * The tour format (PLAN §2.1): its TS types, a small interpreter for the JSON Schema 2020-12
 * keywords `toolkit/schema/*.schema.json` use, and the cross-field checks a schema can't say.
 * The JSON Schema is the single source; this file only reads it. Browser-safe (C4): no Node,
 * no framework, so the runtime (Session 4) and the CLI share it.
 */
import tourSchemaJson from "../../schema/tour.schema.json" with { type: "json" };

// ——— Types (mirroring tour.schema.json) ———

export interface TextMatch {
  pattern: string;
  flags?: string;
}
export type TextOrMatch = string | TextMatch;

export interface Anchor {
  role?: string;
  name?: TextOrMatch;
  label?: TextOrMatch;
  testId?: string;
  text?: TextOrMatch;
  css?: string;
  exact?: boolean;
  nth?: number;
  within?: AnchorRef;
  frame?: string;
}
/** An `@name` from the tour's `anchors`, or an inline anchor. */
export type AnchorRef = string | Anchor;

export type Ready =
  | { kind: "visible" | "exists" | "enabled" | "absent"; anchor: AnchorRef }
  | { kind: "attr"; anchor: AnchorRef; name: string; prop?: boolean; equals?: string; contains?: string; matches?: TextMatch; nonEmpty?: boolean }
  | { kind: "text"; anchor: AnchorRef; equals?: string; contains?: string; matches?: TextMatch }
  | { kind: "count"; anchor: AnchorRef; min?: number; max?: number }
  | { kind: "url"; path?: string; params?: Record<string, string> }
  | { kind: "all" | "any"; of: Ready[] };

export interface Offset {
  x?: number;
  y?: number;
}

interface ActionBase {
  id: string;
  label?: string;
  effect?: "read" | "write";
  done?: Ready;
  timeoutMs?: number;
  navigates?: boolean;
  input?: "trusted" | "synthetic";
}

export type Action = ActionBase &
  (
    | { kind: "goto"; url: string }
    | { kind: "click"; target: AnchorRef; button?: "left" | "right" | "middle"; count?: number }
    | { kind: "type"; target: AnchorRef; text: string; append?: boolean; submit?: "enter" | "button" }
    | { kind: "select"; target: AnchorRef; value?: string; option?: string }
    | { kind: "check"; target: AnchorRef; checked?: boolean }
    | { kind: "hover" | "focus"; target: AnchorRef }
    | { kind: "key"; key: string; target?: AnchorRef }
    | { kind: "press"; target: AnchorRef; ms?: number }
    | { kind: "drag"; target: AnchorRef; to?: AnchorRef; by?: Offset }
    | { kind: "upload"; target: AnchorRef; files: string[] }
    | { kind: "scroll"; target?: AnchorRef; to?: "top" | "bottom" | AnchorRef; by?: Offset; until?: Ready; maxSteps?: number }
    | { kind: "spotlight"; target: AnchorRef; callout?: { title: string; body: string } }
    | { kind: "wait"; ms?: number; until?: Ready }
    | { kind: "hold"; ms: number }
    | { kind: "card"; title: string; lines?: string[]; ms?: number }
    | { kind: "invoke"; name: string; args?: Record<string, unknown> }
    | { kind: "camera"; target?: AnchorRef; scale?: number; end?: true }
  );
export type ActionKind = Action["kind"];

/** A sentence, or one that starts once an action of its beat is done. */
export type Sentence = string | { text: string; after: string };

export interface Card {
  title: string;
  lines?: string[];
}

export interface Beat {
  id: string;
  narration?: Sentence[];
  actions?: Action[];
  ready?: Ready;
  dwellMs?: number;
  card?: Card;
}

export interface Step {
  id: string;
  title?: string;
  path?: string;
  ready?: Ready;
  beats: Beat[];
}

export type TourKind = "pitch" | "walkthrough" | "spotlight" | "howto";
export type Audience = "executives" | "users" | "team" | "developers";
export type Afterwards = "decide" | "try" | "understand" | "champion";

export interface Range {
  min: number;
  max: number;
}

export interface TourMeta {
  kind: TourKind;
  audience: Audience;
  afterwards: Afterwards;
  takeaway?: string;
  language: string;
  length: { targetSec: number; narration?: Range; beats?: Range };
  rules?: { spokenNumbers?: "on-screen-only" | "none"; firstToCut?: string };
  approved?: { storyboard?: string; narrator?: string; final?: string };
}

export interface Tour {
  $schema?: string;
  showcase: 1;
  id: string;
  title: string;
  meta: TourMeta;
  anchors?: Record<string, Anchor>;
  steps: Step[];
}

export const sentenceText = (s: Sentence): string => (typeof s === "string" ? s : s.text);

/** Every beat in order, with its step. */
export function beatsOf(tour: Tour): { step: Step; beat: Beat; path: string }[] {
  return tour.steps.flatMap((step, i) => step.beats.map((beat, b) => ({ step, beat, path: `/steps/${i}/beats/${b}` })));
}

// ——— Issues ———

/**
 * One finding. Rule ids (`showcase docs tour-format` lists them): T001 schema, T002 duplicate id,
 * T003 `after`, T004 write without `done`, T005 `navigates`, T006 unknown `@anchor`,
 * T007 caption too long; T008–T014 are narrative.ts's; T015 a stale storyboard (the CLI's).
 */
export interface Issue {
  rule: string;
  level: "error" | "warning";
  /** A JSON pointer into the tour. */
  path: string;
  message: string;
}

// ——— The JSON Schema interpreter ———

export type JsonSchema = { [k: string]: unknown };

/** The keywords this interpreter understands. Any other keyword in a schema is a bug. */
const KNOWN = new Set([
  "$schema", "$id", "$defs", "$ref", "$comment", "title", "description", "default", "examples",
  "type", "properties", "required", "additionalProperties", "propertyNames", "minProperties",
  "dependentRequired", "items", "minItems", "maxItems", "enum", "const", "minLength", "maxLength",
  "pattern", "minimum", "maximum", "exclusiveMinimum", "anyOf", "oneOf",
]);

interface Err {
  path: string;
  message: string;
}

const typeOf = (v: unknown): string =>
  v === null ? "null" : Array.isArray(v) ? "array" : typeof v === "number" ? (Number.isInteger(v) ? "integer" : "number") : typeof v;

const isObj = (v: unknown): v is Record<string, unknown> => typeOf(v) === "object";
const show = (v: unknown) => JSON.stringify(v);

function typeMatches(want: string, v: unknown): boolean {
  const t = typeOf(v);
  return want === t || (want === "number" && t === "integer");
}

/** A validator bound to one root schema (for `$ref`). */
export class SchemaValidator {
  readonly root: JsonSchema;
  readonly #patterns = new Map<string, RegExp>();

  constructor(root: JsonSchema) {
    this.root = root;
    this.#audit(root, "#");
  }

  /** Every unknown keyword is reported at construction, so a typo can't silently pass. */
  #audit(s: unknown, at: string): void {
    if (!isObj(s)) return;
    for (const [k, v] of Object.entries(s)) {
      if (!KNOWN.has(k)) throw new Error(`schema keyword '${k}' at ${at} isn't supported`);
      if (k === "properties" || k === "$defs") {
        for (const [n, sub] of Object.entries(v as object)) this.#audit(sub, `${at}/${k}/${n}`);
      } else if (k === "anyOf" || k === "oneOf") (v as unknown[]).forEach((sub, i) => this.#audit(sub, `${at}/${k}/${i}`));
      else if (k === "items" || k === "additionalProperties" || k === "propertyNames") this.#audit(v, `${at}/${k}`);
    }
  }

  #resolve(s: JsonSchema): JsonSchema {
    let cur = s;
    for (let hops = 0; typeof cur.$ref === "string"; hops++) {
      const ref = cur.$ref;
      if (!ref.startsWith("#/") || hops > 32) throw new Error(`unsupported $ref '${ref}'`);
      let node: unknown = this.root;
      for (const part of ref.slice(2).split("/")) node = (node as Record<string, unknown>)?.[part];
      if (!isObj(node)) throw new Error(`unresolved $ref '${ref}'`);
      // Sibling keywords of $ref apply too (2020-12); only annotations are used beside it here.
      cur = node;
    }
    return cur;
  }

  #re(p: string): RegExp {
    let r = this.#patterns.get(p);
    if (!r) this.#patterns.set(p, (r = new RegExp(p, "u")));
    return r;
  }

  validate(value: unknown, schema: JsonSchema = this.root): Err[] {
    const errs: Err[] = [];
    this.#check(value, schema, "", errs);
    return errs;
  }

  #check(v: unknown, raw: JsonSchema, path: string, errs: Err[]): void {
    const s = this.#resolve(raw);
    const at = path || "/";
    if (s.type !== undefined) {
      const types = Array.isArray(s.type) ? (s.type as string[]) : [s.type as string];
      if (!types.some((t) => typeMatches(t, v))) {
        errs.push({ path: at, message: `must be ${types.join(" or ")}, not ${typeOf(v)}` });
        return;
      }
    }
    if ("const" in s && show(v) !== show(s.const)) errs.push({ path: at, message: `must be ${show(s.const)}` });
    if (Array.isArray(s.enum) && !s.enum.some((e) => show(e) === show(v)))
      errs.push({ path: at, message: `must be one of ${s.enum.map(show).join(", ")}, not ${show(v)}` });

    if (typeof v === "string") {
      if (typeof s.minLength === "number" && v.length < s.minLength) errs.push({ path: at, message: s.minLength === 1 ? "must not be empty" : `must be at least ${s.minLength} characters` });
      if (typeof s.maxLength === "number" && v.length > s.maxLength) errs.push({ path: at, message: `must be at most ${s.maxLength} characters` });
      if (typeof s.pattern === "string" && !this.#re(s.pattern).test(v)) errs.push({ path: at, message: `${show(v)} must match ${s.pattern}` });
    }
    if (typeof v === "number") {
      if (typeof s.minimum === "number" && v < s.minimum) errs.push({ path: at, message: `must be ≥ ${s.minimum}` });
      if (typeof s.maximum === "number" && v > s.maximum) errs.push({ path: at, message: `must be ≤ ${s.maximum}` });
      if (typeof s.exclusiveMinimum === "number" && v <= s.exclusiveMinimum) errs.push({ path: at, message: `must be > ${s.exclusiveMinimum}` });
    }
    if (Array.isArray(v)) {
      if (typeof s.minItems === "number" && v.length < s.minItems) errs.push({ path: at, message: `needs at least ${s.minItems} item${s.minItems === 1 ? "" : "s"}` });
      if (typeof s.maxItems === "number" && v.length > s.maxItems) errs.push({ path: at, message: `allows at most ${s.maxItems} items` });
      if (isObj(s.items)) v.forEach((item, i) => this.#check(item, s.items as JsonSchema, `${path}/${i}`, errs));
    }
    if (isObj(v)) this.#object(v, s, path, errs);
    if (Array.isArray(s.anyOf)) this.#union(v, s.anyOf as JsonSchema[], path, errs, false);
    if (Array.isArray(s.oneOf)) this.#union(v, s.oneOf as JsonSchema[], path, errs, true);
  }

  #object(v: Record<string, unknown>, s: JsonSchema, path: string, errs: Err[]): void {
    const at = path || "/";
    const props = (s.properties ?? {}) as Record<string, JsonSchema>;
    for (const r of (s.required ?? []) as string[]) if (!(r in v)) errs.push({ path: at, message: `needs '${r}'` });
    if (typeof s.minProperties === "number" && Object.keys(v).length < s.minProperties) errs.push({ path: at, message: "must not be empty" });
    for (const [k, needs] of Object.entries((s.dependentRequired ?? {}) as Record<string, string[]>))
      if (k in v) for (const n of needs) if (!(n in v)) errs.push({ path: at, message: `'${k}' needs '${n}'` });
    for (const [k, val] of Object.entries(v)) {
      const sub = `${path}/${k}`;
      if (isObj(s.propertyNames)) for (const e of this.validate(k, s.propertyNames)) errs.push({ path: sub, message: `name ${e.message}` });
      if (k in props) this.#check(val, props[k] as JsonSchema, sub, errs);
      else if (s.additionalProperties === false) errs.push({ path: sub, message: `unknown property '${k}'` });
      else if (isObj(s.additionalProperties)) this.#check(val, s.additionalProperties, sub, errs);
    }
  }

  /**
   * `anyOf` / `oneOf`, with readable errors: branches discriminated by a `const` property (an
   * action's `kind`) report only the matching branch; otherwise the branch whose type fits.
   */
  #union(v: unknown, raw: JsonSchema[], path: string, errs: Err[], one: boolean): void {
    const at = path || "/";
    const branches = raw.map((b) => this.#resolve(b));
    const passing = branches.filter((b) => this.#passes(v, b, path));
    if (passing.length === 1 || (!one && passing.length > 1)) return;
    if (one && passing.length > 1) {
      errs.push({ path: at, message: "matches more than one alternative" });
      return;
    }
    const disc = this.#discriminator(branches);
    if (disc && isObj(v)) {
      const hit = branches.find((b) => show((b.properties as Record<string, JsonSchema>)[disc]?.const) === show(v[disc]));
      if (hit) return this.#check(v, hit, path, errs);
      const options = branches.map((b) => show((b.properties as Record<string, JsonSchema>)[disc]?.const));
      errs.push({ path: `${path}/${disc}`, message: `must be one of ${options.join(", ")}${disc in v ? `, not ${show(v[disc])}` : ""}` });
      return;
    }
    if (branches.every((b) => Object.keys(b).every((k) => k === "required"))) {
      errs.push({ path: at, message: `needs one of ${branches.map((b) => (b.required as string[]).map((r) => `'${r}'`).join("+")).join(", ")}` });
      return;
    }
    const fits = branches.filter((b) => b.type === undefined || typeMatches(b.type as string, v));
    if (fits.length === 1) return this.#check(v, fits[0] as JsonSchema, path, errs);
    errs.push({ path: at, message: `doesn't match any allowed form (${branches.map((b) => (b.title as string) ?? (b.type as string) ?? "schema").join(", ")})` });
  }

  #passes(v: unknown, b: JsonSchema, path: string): boolean {
    const e: Err[] = [];
    this.#check(v, b, path, e);
    return e.length === 0;
  }

  #discriminator(branches: JsonSchema[]): string | null {
    const first = branches[0]?.properties as Record<string, JsonSchema> | undefined;
    if (!first) return null;
    for (const k of Object.keys(first)) {
      if (branches.every((b) => isObj(b.properties) && isObj((b.properties as Record<string, unknown>)[k]) && "const" in ((b.properties as Record<string, JsonSchema>)[k] as JsonSchema))) return k;
    }
    return null;
  }
}

// ——— The tour ———

export const tourSchema = tourSchemaJson as JsonSchema;
const tourValidator = new SchemaValidator(tourSchema);

/** Caption limits (PLAN §2.8): one sentence per caption, at most 2 lines of 42 characters. */
export const CAPTION_WIDTH = 42;
export const CAPTION_LINES = 2;

/** Greedy wrapping, as the film's ASS captions wrap. A word longer than the width gets a line of its own. */
export function wrapCaption(text: string, width = CAPTION_WIDTH): string[] {
  const lines: string[] = [];
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    const last = lines.at(-1);
    if (last !== undefined && last.length + 1 + word.length <= width) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

export function captionFits(text: string): boolean {
  const lines = wrapCaption(text);
  return lines.length <= CAPTION_LINES && lines.every((l) => l.length <= CAPTION_WIDTH);
}

/** Every `@name` the tour uses, with where. */
function anchorRefs(node: unknown, path: string, out: { name: string; path: string }[]): void {
  if (Array.isArray(node)) node.forEach((n, i) => anchorRefs(n, `${path}/${i}`, out));
  else if (isObj(node))
    for (const [k, v] of Object.entries(node)) {
      if ((k === "target" || k === "anchor" || k === "within" || k === "to") && typeof v === "string" && v.startsWith("@"))
        out.push({ name: v.slice(1), path: `${path}/${k}` });
      else anchorRefs(v, `${path}/${k}`, out);
    }
}

/** T002–T007: what the schema can't say. Assumes the tour passed the schema. */
export function crossFieldIssues(tour: Tour): Issue[] {
  const issues: Issue[] = [];
  const err = (rule: string, path: string, message: string) => issues.push({ rule, level: "error", path, message });

  const steps = new Set<string>();
  tour.steps.forEach((s, i) => {
    if (steps.has(s.id)) err("T002", `/steps/${i}/id`, `duplicate step id '${s.id}'`);
    steps.add(s.id);
  });

  const beats = new Set<string>();
  for (const { beat, path } of beatsOf(tour)) {
    if (beats.has(beat.id)) err("T002", `${path}/id`, `duplicate beat id '${beat.id}' (beat ids are unique in a tour: the voice and the film key on them)`);
    beats.add(beat.id);

    const actions = beat.actions ?? [];
    const ids = new Set<string>();
    actions.forEach((a, i) => {
      if (ids.has(a.id)) err("T002", `${path}/actions/${i}/id`, `duplicate action id '${a.id}' in beat '${beat.id}'`);
      ids.add(a.id);
      if (a.effect === "write" && !a.done) err("T004", `${path}/actions/${i}`, `'${a.id}' is a write with no 'done': it could run twice (C6)`);
      if (a.navigates && i !== actions.length - 1) err("T005", `${path}/actions/${i}`, `'${a.id}' navigates, so it must be the last action of beat '${beat.id}'`);
    });
    const navigating = actions.at(-1)?.navigates ? actions.at(-1)?.id : undefined;
    (beat.narration ?? []).forEach((s, i) => {
      const p = `${path}/narration/${i}`;
      const text = sentenceText(s);
      if (typeof s !== "string") {
        if (!ids.has(s.after)) err("T003", `${p}/after`, `waits for '${s.after}', which isn't an action of beat '${beat.id}'`);
        else if (s.after === navigating) err("T005", `${p}/after`, `waits for '${s.after}', which navigates and runs after the narration`);
      }
      if (!captionFits(text)) {
        const lines = wrapCaption(text);
        err("T007", p, `caption needs ${lines.length} line${lines.length === 1 ? "" : "s"} of up to ${Math.max(...lines.map((l) => l.length))} characters (limit ${CAPTION_LINES} × ${CAPTION_WIDTH}): "${text}"`);
      }
    });
  }

  const refs: { name: string; path: string }[] = [];
  anchorRefs(tour.steps, "/steps", refs);
  anchorRefs(tour.anchors ?? {}, "/anchors", refs);
  for (const r of refs) if (!tour.anchors || !Object.hasOwn(tour.anchors, r.name)) err("T006", r.path, `'@${r.name}' isn't in the tour's anchors`);
  return issues;
}

/** T001 then T002–T007. A tour with schema errors gets no cross-field checks. */
export function validateTour(value: unknown): { tour: Tour | null; issues: Issue[] } {
  const errs = tourValidator.validate(value);
  if (errs.length) return { tour: null, issues: errs.map((e) => ({ rule: "T001", level: "error", path: e.path, message: e.message })) };
  const tour = value as Tour;
  return { tour, issues: crossFieldIssues(tour) };
}
