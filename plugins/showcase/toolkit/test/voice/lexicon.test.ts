import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyLexicon } from "../../voice/lexicon.ts";

describe("lexicon", () => {
  it("applies the longest key first and keeps letter boundaries", () => {
    const lex = { VIP: "V I P", VIPs: "V I Ps", pp: "points", W39: "week thirty-nine", "−": "minus" };
    assert.equal(applyLexicon("The VIPs and one VIP", lex), "The V I Ps and one V I P");
    assert.equal(applyLexicon("We approve a 4pp rise", lex), "We approve a 4points rise");
    assert.equal(applyLexicon("W39 is −3", lex), "week thirty-nine is minus3");
  });

  it("is a single pass: a replacement is never rewritten", () => {
    assert.equal(applyLexicon("A and B", { A: "B", B: "C" }), "B and C");
  });

  it("leaves text alone with an empty lexicon", () => {
    assert.equal(applyLexicon("Nothing to fix.", {}), "Nothing to fix.");
  });
});
