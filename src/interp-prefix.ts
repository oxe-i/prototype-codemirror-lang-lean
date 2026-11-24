import { ExternalTokenizer } from "@lezer/lr";

const S = "s".charCodeAt(0);
const F = "f".charCodeAt(0);
const BANG = "!".charCodeAt(0);
const QUOTE = '"'.charCodeAt(0);

// `s!`/`f!` string interpolation prefixes, kept as their own two-character
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
      (input.next == S || input.next == F) &&
      input.peek(1) == BANG &&
      input.peek(2) == QUOTE
    ) {
      input.acceptToken(interpPrefixTerm, 2);
    }
  });
}
