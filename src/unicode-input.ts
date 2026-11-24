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
export const abbreviations: Readonly<Record<string, string>> = {
  "\\and": "∧",
  "\\or": "∨",
  "\\not": "¬",
  "\\to": "→",
  "\\iff": "↔",
  "\\forall": "∀",
  "\\exists": "∃",
  "\\in": "∈",
  "\\subseteq": "⊆",
  "\\cup": "∪",
  "\\cap": "∩",
  "\\empty": "∅",
  "\\lambda": "λ",
  "\\times": "×",
  "\\le": "≤",
  "\\ge": "≥",
  "\\ne": "≠",
  "\\circ": "∘",
  "\\sum": "Σ",
  "\\alpha": "α",
  "\\beta": "β",
  "\\nat": "ℕ",
};

const trigger = /\\[A-Za-z]+$/;

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
