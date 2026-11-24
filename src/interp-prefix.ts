import { ExternalTokenizer } from "@lezer/lr";
import { readBoundedSegment } from "./ident-utils";

const S = "s".charCodeAt(0);
const F = "f".charCodeAt(0);
const M = "m".charCodeAt(0);
const BANG = "!".charCodeAt(0);
const QUOTE = '"'.charCodeAt(0);

// `s!`/`f!`/`m!` string interpolation prefixes, kept as their own two-character
// token so they can be styled apart from the string that follows (see
// StringInterp in syntax.grammar). A declarative token here would hit the
// same hazard as fusing the prefix and quote used to sidestep: Lezer
// prefers the highest-precedence matching token over the longest one, so
// a plain "s!"/"f!" token would win over Identifier even when nothing
// valid follows (`s!oo`, bare `s!`, `def s! : Nat := 0`), producing dead
// ends instead of falling back to Identifier. Peeking at the quote here,
// without consuming it, keeps the token from ever matching unless the
// interpolation is real — no candidate is offered at all otherwise, so
// Identifier wins uncontested with no precedence contest to get wrong.
//
// Takes the term id as a parameter, rather than importing the generated
// `./syntax.grammar.terms` module directly, so this logic can be reused
// by test/grammar.test.ts's in-memory `buildParser`, which supplies its
// own term id from the builder's term table instead of that (build-only)
// generated module.
export function makeInterpPrefixTokenizer(interpPrefixTerm: number) {
  return new ExternalTokenizer((input) => {
    if (
      (input.next == S || input.next == F || input.next == M) &&
      input.peek(1) == BANG &&
      input.peek(2) == QUOTE
    ) {
      input.acceptToken(interpPrefixTerm, 2);
    }
  });
}

// The keywords whose string argument is interpolated without a prefix, as
// in `panic! "no item at {i}"`: the ones the Lean 4 VS Code extension's
// grammar lists next to `s!` and `m!`.
const INTERP_KEYWORDS: ReadonlySet<string> = new Set([
  "dbg_trace", "panic!", "reportIssue!", "throwError",
]);

const SPACE = " ".charCodeAt(0);
const TAB = "\t".charCodeAt(0);

// Offered only when the keyword is a whole word and a quote follows it on
// the same line, so that the interpolated string the grammar then requires
// (see keywordInterp in syntax.grammar) is always there. Anywhere else the
// word falls back to the ordinary Keyword.
export function makeInterpKeywordTokenizer(interpKeywordTerm: number) {
  return new ExternalTokenizer((input) => {
    const word = readBoundedSegment(input, 0);
    if (!word || !INTERP_KEYWORDS.has(word)) return;
    let after = word.length;
    while (input.peek(after) == SPACE || input.peek(after) == TAB) after++;
    if (input.peek(after) == QUOTE) {
      input.acceptToken(interpKeywordTerm, word.length);
    }
  });
}
