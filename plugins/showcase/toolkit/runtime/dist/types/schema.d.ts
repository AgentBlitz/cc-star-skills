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
export type Ready = {
    kind: "visible" | "exists" | "enabled" | "absent";
    anchor: AnchorRef;
} | {
    kind: "attr";
    anchor: AnchorRef;
    name: string;
    prop?: boolean;
    equals?: string;
    contains?: string;
    matches?: TextMatch;
    nonEmpty?: boolean;
} | {
    kind: "text";
    anchor: AnchorRef;
    equals?: string;
    contains?: string;
    matches?: TextMatch;
} | {
    kind: "count";
    anchor: AnchorRef;
    min?: number;
    max?: number;
} | {
    kind: "url";
    path?: string;
    params?: Record<string, string>;
} | {
    kind: "all" | "any";
    of: Ready[];
};
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
export type Action = ActionBase & ({
    kind: "goto";
    url: string;
} | {
    kind: "click";
    target: AnchorRef;
    button?: "left" | "right" | "middle";
    count?: number;
} | {
    kind: "type";
    target: AnchorRef;
    text: string;
    append?: boolean;
    submit?: "enter" | "button";
} | {
    kind: "select";
    target: AnchorRef;
    value?: string;
    option?: string;
} | {
    kind: "check";
    target: AnchorRef;
    checked?: boolean;
} | {
    kind: "hover" | "focus";
    target: AnchorRef;
} | {
    kind: "key";
    key: string;
    target?: AnchorRef;
} | {
    kind: "press";
    target: AnchorRef;
    ms?: number;
} | {
    kind: "drag";
    target: AnchorRef;
    to?: AnchorRef;
    by?: Offset;
} | {
    kind: "upload";
    target: AnchorRef;
    files: string[];
} | {
    kind: "scroll";
    target?: AnchorRef;
    to?: "top" | "bottom" | AnchorRef;
    by?: Offset;
    until?: Ready;
    maxSteps?: number;
} | {
    kind: "spotlight";
    target: AnchorRef;
    callout?: {
        title: string;
        body: string;
    };
} | {
    kind: "wait";
    ms?: number;
    until?: Ready;
} | {
    kind: "hold";
    ms: number;
} | {
    kind: "card";
    title: string;
    lines?: string[];
    ms?: number;
} | {
    kind: "invoke";
    name: string;
    args?: Record<string, unknown>;
} | {
    kind: "camera";
    target?: AnchorRef;
    scale?: number;
    end?: true;
});
export type ActionKind = Action["kind"];
/** A sentence, or one that starts once an action of its beat is done. */
export type Sentence = string | {
    text: string;
    after: string;
};
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
    length: {
        targetSec: number;
        narration?: Range;
        beats?: Range;
    };
    rules?: {
        spokenNumbers?: "on-screen-only" | "none";
        firstToCut?: string;
    };
    approved?: {
        storyboard?: string;
        narrator?: string;
        final?: string;
    };
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
export declare const sentenceText: (s: Sentence) => string;
/** Every beat in order, with its step. */
export declare function beatsOf(tour: Tour): {
    step: Step;
    beat: Beat;
    path: string;
}[];
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
export type JsonSchema = {
    [k: string]: unknown;
};
interface Err {
    path: string;
    message: string;
}
/** A validator bound to one root schema (for `$ref`). */
export declare class SchemaValidator {
    #private;
    readonly root: JsonSchema;
    constructor(root: JsonSchema);
    validate(value: unknown, schema?: JsonSchema): Err[];
}
export declare const tourSchema: JsonSchema;
/** Caption limits (PLAN §2.8): one sentence per caption, at most 2 lines of 42 characters. */
export declare const CAPTION_WIDTH = 42;
export declare const CAPTION_LINES = 2;
/** Greedy wrapping, as the film's ASS captions wrap. A word longer than the width gets a line of its own. */
export declare function wrapCaption(text: string, width?: number): string[];
export declare function captionFits(text: string): boolean;
/** T002–T007: what the schema can't say. Assumes the tour passed the schema. */
export declare function crossFieldIssues(tour: Tour): Issue[];
/** T001 then T002–T007. A tour with schema errors gets no cross-field checks. */
export declare function validateTour(value: unknown): {
    tour: Tour | null;
    issues: Issue[];
};
export {};
