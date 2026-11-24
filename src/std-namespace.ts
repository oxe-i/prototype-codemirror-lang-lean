import { ExternalTokenizer, InputStream } from "@lezer/lr";
import { STD_NAMESPACE_TYPES, TYPE_NAMES } from "./type-names";
import { readBoundedSegment } from "./ident-utils";

const DOT = ".".charCodeAt(0);

// `Std.<Type>`, and likewise `Lean.<Type>` (the node keeps the name
// StdNamespace for both) — `Std` and the curated type name after it get their own
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
// The namespaces whose types are split off this way: `Std.HashMap`, and
// `Lean.TSyntax` or `Lean.MacroM` in a macro. Returns the length of the
// one at the start of the input with its dot ("Std." is 4), or 0.
const ROOT_NAMESPACES = ["Std", "Lean"];

function rootNamespaceLength(input: InputStream): number {
  for (const root of ROOT_NAMESPACES) {
    let i = 0;
    while (i < root.length && input.peek(i) == root.charCodeAt(i)) i++;
    if (i == root.length && input.peek(i) == DOT) return i + 1;
  }
  return 0;
}

export function makeStdNamespaceTokenizer(stdNamespaceTerm: number) {
  return new ExternalTokenizer((input) => {
    const root = rootNamespaceLength(input);
    if (!root) return;
    const seg = readBoundedSegment(input, root);
    if (!seg) return;
    if (TYPE_NAMES.has(seg)) {
      input.acceptToken(stdNamespaceTerm, root);
      return;
    }
    // `Std.Time.PlainDateTime`: the namespace under `Std` joins the
    // token ("Std.Time."), under the same condition as above, that a
    // type known to live there follows. `Std.Time` on its own, as in
    // `import Std.Time`, stays a plain Identifier like `open Std` does.
    const nested = root == 4 ? STD_NAMESPACE_TYPES.get(seg) : undefined;
    const afterNested = root + seg.length + 1;
    if (nested && input.peek(afterNested - 1) == DOT) {
      const type = readBoundedSegment(input, afterNested);
      if (type && nested.has(type)) {
        input.acceptToken(stdNamespaceTerm, afterNested);
      }
    }
  });
}

export function makeStdTypeNameTokenizer(stdTypeNameTerm: number) {
  return new ExternalTokenizer((input) => {
    // Only reachable right after StdNamespace, which has already checked
    // that this segment belongs to the namespace it consumed, so a name
    // from either list is enough here.
    const seg = readBoundedSegment(input, 0);
    if (seg && (TYPE_NAMES.has(seg) || isNestedStdType(seg))) {
      input.acceptToken(stdTypeNameTerm, seg.length);
    }
  });
}

function isNestedStdType(name: string): boolean {
  for (const types of STD_NAMESPACE_TYPES.values()) {
    if (types.has(name)) return true;
  }
  return false;
}
