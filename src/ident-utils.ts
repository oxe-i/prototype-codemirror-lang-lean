import { InputStream } from "@lezer/lr";

// Mirrors `idRest` in syntax.grammar (letters/digits/underscore/'!?, plus
// the letterLike and subscript unicode ranges), so the boundary this finds
// exactly matches where the grammar's own Identifier token would stop —
// without it, "TreeSetX" could be mistaken for a boundary at "TreeSet".
export function isIdRest(code: number): boolean {
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
export function readBoundedSegment(input: InputStream, offset: number): string | null {
  let text = "";
  let i = offset;
  while (isIdRest(input.peek(i))) {
    text += String.fromCharCode(input.peek(i));
    i++;
  }
  return text.length > 0 ? text : null;
}
