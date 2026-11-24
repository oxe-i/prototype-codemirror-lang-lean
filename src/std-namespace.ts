import { ExternalTokenizer, InputStream } from "@lezer/lr";
import { TYPE_NAMES } from "./type-names";

const S = "S".charCodeAt(0);
const T = "t".charCodeAt(0);
const D = "d".charCodeAt(0);
const DOT = ".".charCodeAt(0);

// Mirrors `idRest` in syntax.grammar (letters/digits/underscore/'!?, plus
// the letterLike and subscript unicode ranges), so the boundary this finds
// exactly matches where the grammar's own Identifier token would stop —
// without it, "TreeSetX" could be mistaken for a boundary at "TreeSet".
function isIdRest(code: number): boolean {
  if (code === 0x5f) return true; // _
  if (code >= 0x41 && code <= 0x5a) return true; // A-Z
  if (code >= 0x61 && code <= 0x7a) return true; // a-z
  if (code >= 0x30 && code <= 0x39) return true; // 0-9
  if (code === 0x27 || code === 0x21 || code === 0x3f) return true; // ' ! ?
  if (code >= 0x3b1 && code <= 0x3ba) return true; // lower greek
  if (code >= 0x3bc && code <= 0x3c9) return true;
  if (code >= 0x391 && code <= 0x39f) return true; // upper greek
  if (code >= 0x3a1 && code <= 0x3a2) return true;
  if (code >= 0x3a4 && code <= 0x3a9) return true;
  if (code >= 0x3ca && code <= 0x3fb) return true; // coptic
  if (code >= 0x1f00 && code <= 0x1ffe) return true; // polytonic greek
  if (code >= 0x2100 && code <= 0x214f) return true; // letterlike symbols
  if (code >= 0x1d49c && code <= 0x1d59f) return true; // script/double-struck/fraktur
  if (code >= 0xc0 && code <= 0xd6) return true; // latin-1 supplement
  if (code >= 0xd8 && code <= 0xf6) return true;
  if (code >= 0xf8 && code <= 0xff) return true;
  if (code >= 0x100 && code <= 0x17f) return true; // latin extended-A
  if (code >= 0x2080 && code <= 0x2089) return true; // subscript digits
  if (code >= 0x2090 && code <= 0x209c) return true;
  if (code >= 0x1d62 && code <= 0x1d6a) return true;
  if (code === 0x2c7c) return true;
  return false;
}

// Reads the run of idRest characters starting at `offset` (via peek, so
// the stream position is never advanced), or null if it's empty.
function readBoundedSegment(input: InputStream, offset: number): string | null {
  let text = "";
  let i = offset;
  while (isIdRest(input.peek(i))) {
    text += String.fromCharCode(input.peek(i));
    i++;
  }
  return text.length > 0 ? text : null;
}

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
