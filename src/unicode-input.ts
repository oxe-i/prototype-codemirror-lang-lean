import { EditorView } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import type { SyntaxNode } from "@lezer/common";

// A small, curated subset of the `\`-abbreviations Lean 4 users type in
// VS Code and the online playground (see leanprover/vscode-lean4's
// unicode-input tables for the full set — this is a short, hand-picked
// list of common ones, not a port of that table). Kept prefix-free on
// purpose: no key here is a prefix of another key, so a match can fire the
// moment it's typed, mirroring Lean's own "expand as soon as it's
// unambiguous" behaviour, without needing to track partial ambiguity
// across a large table.
// `\infty` is left out entirely — it would conflict with `\in` (a shorter
// existing key can't be a prefix of another). `\notin` has the same problem
// against `\not`, but real Lean's own table also ships `\nin` as a
// non-conflicting alternate spelling for the same symbol, so that's used
// below instead of dropping the symbol altogether.
export const abbreviations: Readonly<Record<string, string>> = {
  // Logic and relations
  "\\and": "∧",
  "\\or": "∨",
  "\\not": "¬",
  "\\to": "→",
  "\\iff": "↔",
  "\\forall": "∀",
  "\\exists": "∃",
  "\\vdash": "⊢",
  "\\mapsto": "↦",
  "\\larrow": "←",
  "\\uparrow": "↑",
  "\\le": "≤",
  "\\ge": "≥",
  "\\ne": "≠",
  "\\mid": "∣",

  // Sets
  "\\in": "∈",
  "\\nin": "∉",
  "\\subseteq": "⊆",
  "\\supseteq": "⊇",
  "\\nsubseteq": "⊈",
  "\\cup": "∪",
  "\\cap": "∩",
  "\\bigcup": "⋃",
  "\\bigcap": "⋂",
  "\\empty": "∅",

  // Anonymous-constructor brackets — by far the most common symbol across
  // exercism/lean's exercises (⟨⟩-notation for tuples/structures).
  "\\<": "⟨",
  "\\>": "⟩",

  // Operators and misc
  "\\lambda": "λ",
  "\\times": "×",
  "\\circ": "∘",
  "\\cdot": "⋅",
  "\\.": "·",
  "\\partial": "∂",
  "\\nabla": "∇",

  // Greek letters
  "\\alpha": "α",
  "\\beta": "β",
  "\\gamma": "γ",
  "\\delta": "δ",
  "\\epsilon": "ε",
  "\\theta": "θ",
  "\\mu": "μ",
  "\\pi": "π",
  "\\sigma": "σ",
  "\\phi": "φ",
  "\\omega": "ω",
  "\\Omega": "Ω",
  "\\sum": "Σ",

  // Number systems
  "\\nat": "ℕ",
  "\\R": "ℝ",
  "\\Z": "ℤ",
  "\\Q": "ℚ",
  "\\C": "ℂ",

  // Subscript digits, chainable one at a time (`\1\2` → "₁₂") the same way
  // Lean's own input method handles multi-digit subscripts.
  "\\0": "₀",
  "\\1": "₁",
  "\\2": "₂",
  "\\3": "₃",
  "\\4": "₄",
  "\\5": "₅",
  "\\6": "₆",
  "\\7": "₇",
  "\\8": "₈",
  "\\9": "₉",
};

// Letter sequences (`\to`, `\alpha`, ...) fire once the whole word is
// unambiguous; the bracket/dot/digit shortcuts above are exactly one
// character after the backslash, since none of them extend into a longer
// word the way the letter ones can.
const trigger = /\\(?:[A-Za-z]+|[0-9<>.])$/;

// Given the text immediately before the cursor, including the character
// that was just typed, return the replacement to make if it completes a
// known abbreviation — or null if nothing matches. Pure and
// editor-independent so it can be unit-tested without a DOM.
export function matchAbbreviation(
  textBeforeCursor: string
): { matchLength: number; symbol: string } | null {
  const found = trigger.exec(textBeforeCursor);
  if (!found) return null;
  const symbol = abbreviations[found[0]];
  if (!symbol) return null;
  return { matchLength: found[0].length, symbol };
}

// Node types whose contents shouldn't be rewritten — a `\` in a raw string
// path or inside a comment is literal text, not the start of an
// abbreviation.
const literalNodeNames = new Set([
  "String",
  "RawString",
  "Char",
  "CharEscape",
  "Escape",
  "LineComment",
  "BlockComment",
  "DocComment",
  "ModuleDoc",
  "NestedComment",
]);

function insideLiteralOrComment(view: EditorView, pos: number): boolean {
  let node: SyntaxNode | null = syntaxTree(view.state).resolveInner(pos, -1);
  for (; node; node = node.parent) {
    if (literalNodeNames.has(node.name)) return true;
  }
  return false;
}

function handleInput(
  view: EditorView,
  from: number,
  to: number,
  text: string
): boolean {
  // Only single-character typing at a collapsed cursor is handled — paste,
  // IME composition and multi-character input fall through to the default.
  if (from !== to || text.length !== 1) return false;
  if (insideLiteralOrComment(view, from)) return false;

  const line = view.state.doc.lineAt(from);
  const typedSoFar = line.text.slice(0, from - line.from) + text;
  const found = matchAbbreviation(typedSoFar);
  if (!found) return false;

  const replaceFrom = from - (found.matchLength - 1);
  view.dispatch({
    changes: { from: replaceFrom, to: from, insert: found.symbol },
    selection: { anchor: replaceFrom + found.symbol.length },
    userEvent: "input.type",
  });
  return true;
}

// A CodeMirror extension that expands the abbreviations above as they're
// typed. Bundled into `lean()`'s support extensions, so consumers get it
// for free — no separate wiring needed beyond loading the language.
export const leanUnicodeInput = () => EditorView.inputHandler.of(handleInput);
