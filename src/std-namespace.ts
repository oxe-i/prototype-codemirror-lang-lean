import { ExternalTokenizer } from "@lezer/lr";
import { TYPE_NAMES } from "./type-names";
import { readBoundedSegment } from "./ident-utils";

const S = "S".charCodeAt(0);
const T = "t".charCodeAt(0);
const D = "d".charCodeAt(0);
const DOT = ".".charCodeAt(0);

// `Std.<Type>` — `Std` and the curated type name after it get their own
// nodes (and colors), while anything further (`Std.TreeSet.empty`'s
// `.empty`) is left alone as plain Operator + Identifier. Splitting the
// literal "Std." off is easy, but the type name can't just be the
// existing (dot-chaining) Identifier/TypeName token reused at that
// position: Identifier's own regex would keep going through the next
// dot too (`TreeSet.empty` as one run), so specialize would compare the
// whole "TreeSet.empty" against the curated list, fail, and leave it
// entirely unstyled. Two purpose-built external tokenizers fix this:
// stdNamespaceToken consumes only "Std." — and only when the segment
// right after it (checked by peeking, not consuming) is an exact,
// bounded curated name, so anything else ("Std.foo", bare "Std", as in
// `open Std`) offers no token at all and falls back to plain Identifier
// with no dead end — while stdTypeNameToken, valid only as the required
// continuation right after StdNamespace (see StdQualifiedType in the
// grammar, not reachable from anywhere else `atom` is), matches just
// that one bounded segment without letting a further "." extend it.
export function makeStdNamespaceTokenizer(stdNamespaceTerm: number) {
  return new ExternalTokenizer((input) => {
    if (
      input.next == S &&
      input.peek(1) == T &&
      input.peek(2) == D &&
      input.peek(3) == DOT
    ) {
      const seg = readBoundedSegment(input, 4);
      if (seg && TYPE_NAMES.has(seg)) {
        input.acceptToken(stdNamespaceTerm, 4);
      }
    }
  });
}

export function makeStdTypeNameTokenizer(stdTypeNameTerm: number) {
  return new ExternalTokenizer((input) => {
    const seg = readBoundedSegment(input, 0);
    if (seg && TYPE_NAMES.has(seg)) {
      input.acceptToken(stdTypeNameTerm, seg.length);
    }
  });
}
