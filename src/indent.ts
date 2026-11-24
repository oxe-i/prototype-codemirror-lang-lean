import { TreeIndentContext, syntaxTree } from "@codemirror/language";

// The tokens that open a bracket pair. `InterpBraceStart` is the `{` of an
// interpolation in `s!"…"`.
const opening = new Set(["(", "[", "{", "⟨", "InterpBraceStart"]);

// A line that starts with a focus dot, as in the Lean 4 VS Code extension's
// only `onEnterRules` entry.
const focusDot = /^\s*[·.]\s/;

/// Indentation for a new line, as in the Lean 4 VS Code extension: it starts
/// where the line before it starts, one level deeper when that line ends
/// with an opening bracket or begins with a focus dot.
///
/// Lean's layout carries meaning and is the author's to decide, so this
/// only answers for a line that is being broken (Enter). Asked about a line
/// that already exists, it returns `null`, which leaves the line alone.
export function leanIndent(context: TreeIndentContext): number | null {
  const { pos } = context;
  if (context.simulatedBreak !== pos) return null;
  // Read the line from the document itself: with the double break that
  // Enter simulates between a pair of brackets, the context reports the
  // text before the break as empty.
  const line = context.state.doc.lineAt(pos);
  const before = line.text.slice(0, pos - line.from);
  const indent = context.countColumn(before, before.search(/\S|$/));
  if (focusDot.test(before)) return indent + context.unit;
  const text = before.trimEnd();
  if (text === "") return indent;
  const last = syntaxTree(context.state).resolveInner(
    line.from + text.length,
    -1
  );
  return opening.has(last.name) ? indent + context.unit : indent;
}
