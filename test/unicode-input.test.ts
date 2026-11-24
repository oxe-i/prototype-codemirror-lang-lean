import { describe, expect, test } from "bun:test";
import {
  EditorSelection,
  EditorState,
  Extension,
  Transaction,
  TransactionSpec,
} from "@codemirror/state";
import { LRLanguage } from "@codemirror/language";
import { history, undo } from "@codemirror/commands";
import { AbbreviationProvider } from "@leanprover/unicode-input";
import {
  AbbreviationHost,
  AbbreviationSession,
  LeanUnicodeInputConfig,
} from "../src/unicode-input";
import { parser } from "./parser";

const leanForTests = LRLanguage.define({ parser });

// Stands in for an EditorView: holds a state and drives an
// AbbreviationSession the way the view plugin and update listener in
// `leanUnicodeInput()` do, so that typing can be tested without a DOM.
class Editor implements AbbreviationHost {
  state: EditorState;
  readonly session: AbbreviationSession;
  readonly userEvents: (string | undefined)[] = [];

  constructor(
    doc = "",
    config: LeanUnicodeInputConfig = {},
    extensions: Extension = []
  ) {
    this.state = EditorState.create({
      doc,
      selection: { anchor: doc.length },
      extensions: [
        leanForTests,
        history(),
        EditorState.allowMultipleSelections.of(true),
        extensions,
      ],
    });
    this.session = new AbbreviationSession(this, config);
  }

  dispatch(spec: TransactionSpec): void {
    this.apply(this.state.update(spec));
  }

  apply(tr: Transaction): void {
    this.userEvents.push(tr.annotation(Transaction.userEvent));
    this.session.applyChanges(tr.startState, tr.changes);
    this.state = tr.state;
    void this.session.afterUpdate(tr.docChanged, tr.selection !== undefined);
  }

  // Resolves once the session has nothing left to do.
  async settled(): Promise<void> {
    let tail: Promise<void>;
    do {
      tail = this.session.afterUpdate(false, false);
      await tail;
    } while (tail !== this.session.afterUpdate(false, false));
  }

  // Type `text` one character at a time, at every cursor.
  async type(text: string): Promise<this> {
    for (const char of text) {
      this.dispatch({
        ...this.state.replaceSelection(char),
        userEvent: "input.type",
      });
      await this.settled();
    }
    return this;
  }

  async moveTo(...positions: number[]): Promise<this> {
    this.dispatch({
      selection: EditorSelection.create(
        positions.map((pos) => EditorSelection.cursor(pos))
      ),
    });
    await this.settled();
    return this;
  }

  async convert(): Promise<this> {
    await this.session.convertAll();
    await this.settled();
    return this;
  }

  get doc(): string {
    return this.state.doc.toString();
  }

  get cursors(): number[] {
    return this.state.selection.ranges.map((range) => range.head);
  }

  // The text of what the session is tracking (and the view underlines).
  get tracked(): string[] {
    return this.session.tracked.map(({ from, to }) =>
      this.state.sliceDoc(from, to)
    );
  }
}

const typed = async (text: string, config?: LeanUnicodeInputConfig) =>
  (await new Editor("", config).type(text)).doc;

describe("the abbreviation table", () => {
  // The table is not kept in this repository: it is the one shipped in
  // `@leanprover/unicode-input`, which is what the VS Code extension uses.
  const table = new AbbreviationProvider({
    abbreviationCharacter: "\\",
    customTranslations: {},
    eagerReplacementEnabled: true,
  }).getSymbolsByAbbreviation();

  test("is the upstream one", () => {
    expect(Object.keys(table).length).toBeGreaterThan(1800);
    expect(table["to"]).toBe("→");
    expect(table["<>"]).toBe("⟨$CURSOR⟩");
    expect(table["alpha"]).toBe("α");
  });

  test("every abbreviation can be typed", async () => {
    // Type each abbreviation followed by Tab-to-convert, and compare with
    // what the table says, cursor placement included.
    const editor = new Editor();
    for (const [abbreviation, symbol] of Object.entries(table)) {
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length },
        selection: { anchor: 0 },
      });
      await editor.type("\\" + abbreviation);
      await editor.convert();
      const cursor = symbol.indexOf("$CURSOR");
      const text = symbol.replace("$CURSOR", "");
      expect([abbreviation, editor.doc]).toEqual([abbreviation, text]);
      expect([abbreviation, editor.cursors]).toEqual([
        abbreviation,
        [cursor < 0 ? text.length : cursor],
      ]);
    }
  });
});

describe("replacing as VS Code does", () => {
  test("when the next character can't continue the abbreviation", async () => {
    const editor = new Editor();
    await editor.type("\\to");
    // `\to` could still become `\top`, so nothing happens yet.
    expect(editor.doc).toBe("\\to");
    expect(editor.tracked).toEqual(["\\to"]);
    await editor.type(" ");
    expect(editor.doc).toBe("→ ");
    expect(editor.cursors).toEqual([2]);
    expect(editor.tracked).toEqual([]);
  });

  test("at once when it is complete and unambiguous", async () => {
    expect(await typed("\\forall")).toBe("∀");
    expect(await typed("\\times")).toBe("×");
    expect(await typed("\\0")).toBe("₀");
  });

  test("the shortest abbreviation that starts with what was typed", async () => {
    expect(await typed("\\al ")).toBe("∀ ");
    expect(await typed("\\alp ")).toBe("α ");
    expect(await typed("\\l ")).toBe("← ");
    expect(await typed("\\la ")).toBe("λ ");
    expect(await typed("\\r ")).toBe("→ ");
    expect(await typed("\\x ")).toBe("× ");
    expect(await typed("\\. ")).toBe("· ");
    expect(await typed("\\N ")).toBe("ℕ ");
    expect(await typed("\\ne ")).toBe("≠ ");
    expect(await typed("\\and ")).toBe("∧ ");
    expect(await typed("\\or ")).toBe("∨ ");
    expect(await typed("\\not ")).toBe("¬ ");
    expect(await typed("\\sum ")).toBe("∑ ");
    expect(await typed("\\cdot ")).toBe("· ");
  });

  test("keeps what follows the abbreviation", async () => {
    expect(await typed("\\alp7")).toBe("α7");
    expect(await typed("(a : \\a) \\to \\b\n")).toBe("(a : α) → β\n");
    expect(await typed("\\<a, b\\>\n")).toBe("⟨a, b⟩\n");
    expect(await typed("\\fun x \\mapsto x")).toBe("λ x ↦ x");
  });

  test("puts the cursor where the abbreviation says", async () => {
    const editor = await new Editor().type("\\<>");
    expect(editor.doc).toBe("⟨⟩");
    expect(editor.cursors).toEqual([1]);
    await editor.type("x");
    expect(editor.doc).toBe("⟨x⟩");
  });

  test("an escaped leader is a leader", async () => {
    expect(await typed("\\\\")).toBe("\\");
    expect(await typed("\\\\to ")).toBe("\\to ");
  });

  test("leaves alone what is no abbreviation", async () => {
    const editor = await new Editor().type("\\@");
    expect(editor.doc).toBe("\\@");
    expect(editor.tracked).toEqual([]);
    expect(await typed("\\ x")).toBe("\\ x");
  });

  test("when the cursor leaves the abbreviation", async () => {
    const editor = await new Editor("abc ").type("\\to");
    expect(editor.doc).toBe("abc \\to");
    await editor.moveTo(1);
    expect(editor.doc).toBe("abc →");
    expect(editor.cursors).toEqual([1]);
  });

  test("not while the cursor only moves within it", async () => {
    const editor = await new Editor().type("\\to");
    await editor.moveTo(2);
    expect(editor.doc).toBe("\\to");
    await editor.moveTo(0);
    expect(editor.doc).toBe("\\to");
    expect(editor.tracked).toEqual(["\\to"]);
  });

  test("editing inside the abbreviation keeps tracking it", async () => {
    const editor = await new Editor().type("\\lamb");
    expect(editor.doc).toBe("\\lamb");
    // Backspace over the `b`, and settle for `\lam`.
    editor.dispatch({ changes: { from: 4, to: 5 }, userEvent: "delete.backward" });
    await editor.settled();
    expect(editor.tracked).toEqual(["\\lam"]);
    await editor.type(" ");
    expect(editor.doc).toBe("λ ");
  });

  test("deleting the leader stops tracking", async () => {
    const editor = await new Editor().type("\\to");
    editor.dispatch({ changes: { from: 0, to: 1 } });
    await editor.settled();
    expect(editor.tracked).toEqual([]);
    await editor.type(" ");
    expect(editor.doc).toBe("to ");
  });

  test("on request, as Tab does", async () => {
    const editor = await new Editor().type("\\to");
    await editor.convert();
    expect(editor.doc).toBe("→");
    expect(editor.cursors).toEqual([1]);
  });

  test("on request, before the request returns", async () => {
    // What follows a request (the rest of a key binding, a host reading
    // the document as a button is pressed) must find the symbol there.
    const editor = await new Editor().type("x \\to");
    void editor.session.convertAll();
    expect(editor.doc).toBe("x →");
    await editor.settled();
    expect(editor.doc).toBe("x →");

    // Only the cursor an abbreviation places comes a moment later.
    await editor.type(" \\[]");
    expect(editor.tracked).toEqual(["\\[]"]);
    void editor.session.convertAll();
    expect(editor.doc).toBe("x → []");
    await editor.settled();
    expect(editor.cursors).toEqual([5]);
  });

  test("requests made while one is running wait their turn", async () => {
    const editor = await new Editor().type("\\to");
    const first = editor.session.convertAll();
    const second = editor.session.convertAll();
    await Promise.all([first, second]);
    await editor.settled();
    expect(editor.doc).toBe("→");
    expect(editor.tracked).toEqual([]);
  });

  test("at every cursor", async () => {
    const editor = new Editor("a\nb\n");
    await editor.moveTo(1, 3);
    await editor.type(" \\to ");
    expect(editor.doc).toBe("a → \nb → \n");
    expect(editor.cursors).toEqual([4, 9]);
  });

  test("in comments too", async () => {
    expect(await (await new Editor("-- ").type("\\to ")).doc).toBe("-- → ");
    expect(await (await new Editor("/- ").type("\\a -/")).doc).toBe("/- α -/");
  });

  test("only text that is exactly the leader starts an abbreviation", async () => {
    const editor = new Editor();
    // Pasted, for instance.
    editor.dispatch({
      changes: { from: 0, insert: "\\to" },
      selection: { anchor: 3 },
    });
    await editor.settled();
    expect(editor.tracked).toEqual([]);
    await editor.type(" ");
    expect(editor.doc).toBe("\\to ");
  });
});

describe("string and character literals", () => {
  const inString = async (text: string, config?: LeanUnicodeInputConfig) => {
    // As with bracket closing on: the cursor sits between the quotes.
    const editor = new Editor('def s := ""', config);
    await editor.moveTo(10);
    await editor.type(text);
    return editor.doc.slice(9);
  };

  test("escapes are typed as they are", async () => {
    expect(await inString("a\\tb")).toBe('"a\\tb"');
    expect(await inString("\\r\\n")).toBe('"\\r\\n"');
    expect(await inString('say \\"hi\\" ')).toBe('"say \\"hi\\" "');
    expect(await inString("\\x41 \\u{3bb}")).toBe('"\\x41 \\u{3bb}"');
  });

  test("also in a string that isn't closed yet", async () => {
    expect(await typed('def s := "a\\tb')).toBe('def s := "a\\tb');
    expect(await typed('def s := s!"a\\tb')).toBe('def s := s!"a\\tb');
    expect(await typed('def s := r"a\\tb')).toBe('def s := r"a\\tb');
  });

  test("and in a character literal", async () => {
    expect(await typed("def c := '\\t'")).toBe("def c := '\\t'");
    expect(await typed("def c := '\\x41'")).toBe("def c := '\\x41'");
    // A prime at the end of a name is not a character literal.
    expect(await typed("x'\\to ")).toBe("x'→ ");
  });

  test("the code in an interpolation is code", async () => {
    const editor = new Editor('def s := s!"{}"');
    await editor.moveTo(13);
    await editor.type("xs.map \\fun x \\mapsto x");
    expect(editor.doc).toBe('def s := s!"{xs.map λ x ↦ x}"');
    // Behind the closing brace it is string again.
    await editor.moveTo(editor.doc.length - 1);
    await editor.type("\\t");
    expect(editor.doc).toBe('def s := s!"{xs.map λ x ↦ x}\\t"');
    // An interpolation that isn't closed yet is code as well.
    expect(await typed('def s := s!"a{xs.map \\fun x')).toBe(
      'def s := s!"a{xs.map λ x'
    );
  });

  test("after the closing quote it is code again", async () => {
    expect(await (await new Editor('"a"').type(" \\to ")).doc).toBe('"a" → ');
  });

  test("VS Code's behaviour is available as an option", async () => {
    const config = { inStringLiterals: true };
    expect(await inString("a\\t b", config)).toBe('"a▸ b"');
    // `\n` is safe either way: the table maps it to itself.
    expect(await inString("a\\nb", config)).toBe('"a\\nb"');
  });
});

describe("configuration", () => {
  test("another leader", async () => {
    expect(await typed(";to \\to ", { leader: ";" })).toBe("→ \\to ");
  });

  test("custom translations", async () => {
    const config = { customTranslations: { foo: "☺", to: "⇒" } };
    expect(await typed("\\foo \\to ", config)).toBe("☺ ⇒ ");
  });

  test("without eager replacement", async () => {
    const editor = await new Editor("", { eagerReplacement: false }).type(
      "\\forall"
    );
    expect(editor.doc).toBe("\\forall");
    await editor.type(" ");
    expect(editor.doc).toBe("∀ ");
  });
});

describe("as a guest in someone else's editor", () => {
  test("replacing the whole document forgets what was being typed", async () => {
    // exercism/website's `setValue` does exactly this.
    const editor = await new Editor().type("\\to");
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: "def x := 1\n" },
      selection: { anchor: 0 },
    });
    await editor.settled();
    expect(editor.tracked).toEqual([]);
    expect(editor.doc).toBe("def x := 1\n");
    await editor.type(" ");
    expect(editor.doc).toBe(" def x := 1\n");
  });

  test("changes elsewhere move the abbreviation along", async () => {
    const editor = await new Editor("ab").type("\\to");
    editor.dispatch({ changes: { from: 0, insert: "-- note\n" } });
    await editor.settled();
    expect(editor.tracked).toEqual(["\\to"]);
    await editor.type(" ");
    expect(editor.doc).toBe("-- note\nab→ ");
  });

  test("a read-only editor is left alone", async () => {
    const editor = new Editor("", {}, EditorState.readOnly.of(true));
    await editor.type("\\to ");
    expect(editor.doc).toBe("\\to ");
    expect(editor.tracked).toEqual([]);
  });

  test("the replacement is one undo step", async () => {
    const editor = await new Editor().type("x \\to y");
    expect(editor.doc).toBe("x → y");
    expect(editor.userEvents).toContain("input.abbreviation");
    const step = () =>
      undo({ state: editor.state, dispatch: (tr) => editor.apply(tr) });
    step();
    await editor.settled();
    expect(editor.doc).toBe("x → ");
    step();
    await editor.settled();
    // Back to what was typed, and it stays that way.
    expect(editor.doc).toBe("x \\to ");
    expect(editor.tracked).toEqual([]);
    await editor.type("y");
    expect(editor.doc).toBe("x \\to y");
  });
});
