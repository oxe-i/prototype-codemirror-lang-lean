import { ExternalTokenizer } from "@lezer/lr";
import { TYPE_NAMES } from "./type-names";
import { readBoundedSegment } from "./ident-utils";

const DOT = ".".charCodeAt(0);

// `IO.println`, `Nat.succ` — only the curated type name and the dot after
// it (`IO.`, `Nat.`) get their own node/color; the segment after that is
// left alone as a plain Identifier, the same way Std.TreeSet.empty leaves
// `empty` plain after `TreeSet.` (see std-namespace.ts, which this
// mirrors). Reusing Identifier/TypeName for just the "IO" part doesn't
// work here either:
// Identifier's own regex keeps going through the dot (matching
// "IO.println" as one run), so specialize would compare that whole run
// against the curated list, fail, and leave it entirely unstyled — hence
// a dedicated external tokenizer that stops right after the dot.
//
// Unlike StdNamespace, this doesn't need to verify what follows the dot:
// "IO." isn't required to be part of anything (no wrapping grammar rule
// depends on a continuation existing), so it's a well-formed token on its
// own even with nothing, or nothing valid, after it — matching how a
// curated type name is already highlighted standalone (as TypeName) with
// no such requirement either.
export function makeQualifiedTypeTokenizer(qualifiedTypeTerm: number) {
  return new ExternalTokenizer((input) => {
    const seg = readBoundedSegment(input, 0);
    if (seg && TYPE_NAMES.has(seg) && input.peek(seg.length) == DOT) {
      input.acceptToken(qualifiedTypeTerm, seg.length + 1);
    }
  });
}
