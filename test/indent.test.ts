import { describe, expect, test } from "bun:test";
import { EditorState } from "@codemirror/state";
import {
  LRLanguage,
  getIndentation,
  indentNodeProp,
} from "@codemirror/language";
import { insertNewlineAndIndent } from "@codemirror/commands";
import { leanIndent } from "../src/indent";
import { parser } from "./parser";

const leanForTests = LRLanguage.define({
  parser: parser.configure({
    props: [indentNodeProp.add(() => leanIndent)],
  }),
});

// Press Enter at the last `|` and return the document, with `|` at the new cursor.
function enter(doc: string): string {
  const at = doc.lastIndexOf("|");
  let state = EditorState.create({
    doc: doc.slice(0, at) + doc.slice(at + 1),
    selection: { anchor: at },
    extensions: [leanForTests],
  });
  insertNewlineAndIndent({ state, dispatch: (tr) => (state = tr.state) });
  const head = state.selection.main.head;
  const text = state.doc.toString();
  return text.slice(0, head) + "|" + text.slice(head);
}

describe("Enter", () => {
  test("keeps the indentation of the line it leaves", () => {
    expect(enter("def f (n : Nat) : Nat :=\n  let x := n + 1|")).toBe(
      "def f (n : Nat) : Nat :=\n  let x := n + 1\n  |"
    );
    expect(enter("def f : Nat :=|")).toBe("def f : Nat :=\n|");
    expect(enter("    | none => 0|")).toBe("    | none => 0\n    |");
  });

  test("keeps it inside brackets too", () => {
    expect(enter("  xs.map (fun x =>\n      if x > 0|")).toBe(
      "  xs.map (fun x =>\n      if x > 0\n      |"
    );
    expect(enter("  String.foldl (fun map char =>|)")).toBe(
      "  String.foldl (fun map char =>\n  |)"
    );
  });

  test("goes one level deeper after an opening bracket", () => {
    expect(enter("  let p : Point := {|")).toBe("  let p : Point := {\n    |");
    expect(enter("  foo (|)")).toBe("  foo (\n    |\n  )");
    expect(enter("  foo [|]")).toBe("  foo [\n    |\n  ]");
    expect(enter("  exact ⟨|")).toBe("  exact ⟨\n    |");
    expect(enter('  s!"{|')).toBe('  s!"{\n    |');
  });

  test("an opening bracket in a string or a comment does not count", () => {
    expect(enter('  let s := "(|')).toBe('  let s := "(\n  |');
    expect(enter("  -- see (|")).toBe("  -- see (\n  |");
  });

  test("goes one level deeper under a focus dot", () => {
    expect(enter("  · intro h|")).toBe("  · intro h\n    |");
    expect(enter("  . simp|")).toBe("  . simp\n    |");
    expect(enter("  ·.foldl f|")).toBe("  ·.foldl f\n  |");
  });

  test("leaves a blank line's indentation alone", () => {
    expect(enter("  x\n    |")).toBe("  x\n\n    |");
  });
});

describe("existing lines", () => {
  test("are never re-indented", () => {
    const doc = "foo (fun x =>\n    x\n        ) y";
    const state = EditorState.create({ doc, extensions: [leanForTests] });
    for (let line = 1; line <= state.doc.lines; line++)
      expect(getIndentation(state, state.doc.line(line).from)).toBeNull();
  });
});
