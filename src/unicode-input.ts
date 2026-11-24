import {
  ChangeSet,
  EditorSelection,
  EditorState,
  Extension,
  Prec,
  StateEffect,
  TransactionSpec,
} from "@codemirror/state";
import {
  Command,
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  keymap,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import {
  AbbreviationProvider,
  AbbreviationRewriter,
  Range as OffsetRange,
} from "@leanprover/unicode-input";
import type {
  AbbreviationConfig,
  AbbreviationTextSource,
  Change,
  SelectionMoveMode,
} from "@leanprover/unicode-input";
import type { SyntaxNode } from "@lezer/common";

// Lean's `\`-abbreviations (`\to` → `→`, `\<>` → `⟨⟩`, `\alpha` → `α`, ...),
// behaving the way they do in the Lean 4 VS Code extension.
//
// Both the abbreviation table and the rules for when an abbreviation is
// replaced come from `@leanprover/unicode-input`, the package the VS Code
// extension itself is built on, so the two cannot drift apart: this file
// holds no table and no matching logic of its own. All it does is connect
// that engine to a CodeMirror editor, the way `VSCodeAbbreviationRewriter`
// connects it to a VS Code one:
//
//   - every document change is reported to the engine, which tracks the
//     abbreviation being typed;
//   - after each change the engine replaces whatever is finished (the next
//     character can't continue any abbreviation) or, with eager replacement,
//     complete and unambiguous;
//   - moving the cursor out of an abbreviation, pressing Tab, or leaving the
//     editor replaces it too;
//   - the abbreviation being typed is underlined.

export interface LeanUnicodeInputConfig {
  /// The character that starts an abbreviation. Defaults to `\`, like VS
  /// Code's `lean4.input.leader`.
  leader?: string;
  /// Extra abbreviations, without the leader (`{ foo: "☺" }` adds `\foo`).
  /// They take precedence over the built-in ones. This is VS Code's
  /// `lean4.input.customTranslations`.
  customTranslations?: { [abbreviation: string]: string };
  /// Replace an abbreviation as soon as it is complete and no other
  /// abbreviation starts with it, without waiting for the next character.
  /// Defaults to true, like VS Code's `lean4.input.eagerReplacementEnabled`.
  eagerReplacement?: boolean;
  /// Whether a leader typed inside a string or character literal starts an
  /// abbreviation. VS Code does this, which turns the escapes `\t`, `\r`,
  /// `\"` and `\x41` into `▸`, `→`, `Ä` and `×41` as they are typed. The
  /// default here is false, so that escapes can be typed normally; the code
  /// inside an `s!"…{…}…"` interpolation is not affected either way.
  inStringLiterals?: boolean;
}

type ResolvedConfig = AbbreviationConfig & { inStringLiterals: boolean };

function resolveConfig(config: LeanUnicodeInputConfig): ResolvedConfig {
  return {
    abbreviationCharacter: config.leader ?? "\\",
    customTranslations: config.customTranslations ?? {},
    eagerReplacementEnabled: config.eagerReplacement ?? true,
    inStringLiterals: config.inStringLiterals ?? false,
  };
}

const stringLiteralNodes = new Set([
  "String",
  "RawString",
  "StringInterp",
  "Char",
  "CharEscape",
]);

// Whether `pos` is inside the quotes of a string or character literal.
function insideStringLiteral(state: EditorState, pos: number): boolean {
  const inner = syntaxTree(state).resolveInner(pos, -1);
  // A character literal that is still being typed is not a literal to the
  // parser yet: all there is before the cursor is a lone `'` operator.
  // (`x'` is an identifier, so a leader after it still starts an
  // abbreviation.)
  if (
    inner.name === "Operator" &&
    inner.to === pos &&
    state.sliceDoc(pos - 1, pos) === "'"
  )
    return true;
  for (let node: SyntaxNode | null = inner; node; node = node.parent) {
    // Strictly inside the node, or at the end of one that isn't closed yet
    // (a string without its closing quote runs to the end of the document).
    const inside =
      node.from < pos && (pos < node.to || !!node.lastChild?.type.isError);
    if (!inside) continue;
    // The braces of an `s!"…{…}…"` interpolation hold ordinary code.
    if (node.name === "InterpBraces") return false;
    if (stringLiteralNodes.has(node.name)) return true;
  }
  return false;
}

/// What the abbreviation engine needs from an editor. An `EditorView`
/// satisfies it; the tests use a headless stand-in.
export interface AbbreviationHost {
  readonly state: EditorState;
  dispatch(spec: TransactionSpec): void;
}

// Dispatched when the set of tracked abbreviations changed without the
// document changing, so that the underline is redrawn.
const trackingChanged = StateEffect.define<null>();

/// Connects one editor to the abbreviation engine. The host must call
/// `applyChanges` for every transaction as it is applied, and `afterUpdate`
/// once the new state is in place.
export class AbbreviationSession implements AbbreviationTextSource {
  private readonly rewriter: AbbreviationRewriter;
  // Replacements run one after the other: each one may dispatch, which
  // reports further changes while it is still in progress.
  private queue: Promise<void> = Promise.resolve();
  private failed = false;
  private destroyed = false;
  private readonly config: ResolvedConfig;

  constructor(
    private readonly host: AbbreviationHost,
    config: LeanUnicodeInputConfig = {},
    provider?: AbbreviationProvider
  ) {
    this.config = resolveConfig(config);
    this.rewriter = new AbbreviationRewriter(
      this.config,
      provider ?? new AbbreviationProvider(this.config),
      this
    );
  }

  /// The abbreviations being typed, leader included, as document ranges.
  get tracked(): { from: number; to: number }[] {
    const ranges = [];
    for (const { range } of this.rewriter.getTrackedAbbreviations())
      ranges.push({ from: range.offset, to: range.offset + range.length });
    return ranges.sort((a, b) => a.from - b.from);
  }

  /// Report a transaction's changes. Never dispatches, so it is safe to
  /// call while the editor is updating.
  applyChanges(startState: EditorState, changes: ChangeSet): void {
    if (changes.empty) return;
    const { abbreviationCharacter: leader, inStringLiterals } = this.config;
    const input: Change[] = [];
    changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
      let newText = inserted.toString();
      // The engine starts tracking when the inserted text is the leader.
      // Where that must not happen, report text of the same length that
      // isn't the leader, so that the positions it keeps stay correct.
      if (
        newText === leader &&
        !inStringLiterals &&
        insideStringLiteral(startState, fromA)
      )
        newText = "\0".repeat(newText.length);
      input.push({ range: new OffsetRange(fromA, toA - fromA), newText });
    });
    try {
      this.rewriter.changeInput(input);
    } catch {
      this.rewriter.resetTrackedAbbreviations();
    }
  }

  /// Let the engine react to the update that was just applied: replace what
  /// the change finished, and what the cursor has left. Resolves once the
  /// editor is up to date.
  afterUpdate(docChanged: boolean, selectionSet: boolean): Promise<void> {
    if (!docChanged && !selectionSet) return this.queue;
    if (this.rewriter.getTrackedAbbreviations().size === 0) return this.queue;
    return this.enqueue(async () => {
      if (docChanged) await this.rewriter.triggerAbbreviationReplacement();
      await this.rewriter.changeSelections(this.collectSelections());
    });
  }

  /// Replace every abbreviation being typed, finished or not. This is VS
  /// Code's `lean4.input.convert`, which it binds to Tab.
  convertAll(): Promise<void> {
    return this.enqueue(() => this.rewriter.replaceAllTrackedAbbreviations());
  }

  destroy(): void {
    this.destroyed = true;
    this.rewriter.resetTrackedAbbreviations();
  }

  private enqueue(step: () => Promise<void>): Promise<void> {
    return (this.queue = this.queue.then(async () => {
      if (this.destroyed) return;
      try {
        await step();
      } catch {
        this.failed = true;
      }
      if (this.failed && !this.destroyed) {
        // Whatever went wrong, typing must keep working: forget what was
        // being tracked and start afresh at the next leader.
        this.failed = false;
        const wasTracking = this.rewriter.getTrackedAbbreviations().size > 0;
        this.rewriter.resetTrackedAbbreviations();
        if (wasTracking) this.host.dispatch({ effects: trackingChanged.of(null) });
      }
    }));
  }

  // AbbreviationTextSource, the engine's view of the editor.

  replaceAbbreviations(changes: Change[]): Promise<boolean> {
    try {
      const { state } = this.host;
      if (state.readOnly) throw new Error("The editor is read-only");
      if (changes.length === 0) {
        // Nothing to replace (the abbreviation matched nothing), but it is
        // no longer tracked, so its underline has to go.
        this.host.dispatch({ effects: trackingChanged.of(null) });
        return Promise.resolve(true);
      }
      const changeSet = state.changes(
        changes.map(({ range, newText }) => ({
          from: range.offset,
          to: range.offset + range.length,
          insert: newText,
        }))
      );
      this.host.dispatch({
        changes: changeSet,
        // A cursor inside an abbreviation ends up after its symbol.
        selection: state.selection.map(changeSet, 1),
        // Not "input.type": the replacement then is an undo step of its
        // own, so that one undo brings back the abbreviation as typed.
        userEvent: "input.abbreviation",
      });
      return Promise.resolve(true);
    } catch {
      this.failed = true;
      return Promise.resolve(false);
    }
  }

  selectionMoveMode(): SelectionMoveMode {
    // As in VS Code: only a cursor that sits right behind a replaced
    // abbreviation moves, to where the abbreviation says the cursor goes
    // (between the brackets of `\<>`, for instance).
    return { kind: "OnlyMoveCursorSelections", updateUnchangedSelections: false };
  }

  collectSelections(): OffsetRange[] {
    return this.host.state.selection.ranges.map(
      (range) => new OffsetRange(range.from, range.to - range.from)
    );
  }

  setSelections(selections: OffsetRange[]): void {
    const { state } = this.host;
    const current = state.selection;
    if (selections.length === 0 || selections.length !== current.ranges.length)
      return;
    const length = state.doc.length;
    let moved = false;
    const ranges = selections.map((selection, i) => {
      const from = Math.min(selection.offset, length);
      const to = Math.min(selection.offset + selection.length, length);
      const before = current.ranges[i];
      if (before.from === from && before.to === to) return before;
      moved = true;
      return EditorSelection.range(from, to);
    });
    if (moved)
      this.host.dispatch({
        selection: EditorSelection.create(ranges, current.mainIndex),
      });
  }
}

// The session of each editor that has the extension, for the command below.
const sessions = new WeakMap<EditorView, AbbreviationSession>();

// VS Code underlines the abbreviation being typed.
const trackedMark = Decoration.mark({ class: "cm-lean-abbreviation" });

const abbreviationTheme = EditorView.baseTheme({
  ".cm-lean-abbreviation": { textDecoration: "underline" },
});

class AbbreviationPlugin {
  readonly session: AbbreviationSession;
  decorations: DecorationSet = Decoration.none;

  constructor(
    private readonly view: EditorView,
    config: LeanUnicodeInputConfig,
    provider: AbbreviationProvider
  ) {
    this.session = new AbbreviationSession(view, config, provider);
    sessions.set(view, this.session);
  }

  update(update: ViewUpdate): void {
    for (const tr of update.transactions)
      this.session.applyChanges(tr.startState, tr.changes);
    const length = update.state.doc.length;
    this.decorations = Decoration.set(
      this.session.tracked
        .filter(({ from, to }) => from < to && to <= length)
        .map(({ from, to }) => trackedMark.range(from, to))
    );
  }

  destroy(): void {
    this.session.destroy();
    if (sessions.get(this.view) === this.session) sessions.delete(this.view);
  }
}

/// Replace the abbreviations being typed with their symbols right away.
/// Returns false, leaving the key to other bindings, when there are none.
export const convertLeanAbbreviations: Command = (view) => {
  const session = sessions.get(view);
  if (!session || session.tracked.length === 0) return false;
  void session.convertAll();
  return true;
};

/// Lean's `\`-abbreviations, as an extension. `lean()` includes it.
export function leanUnicodeInput(config: LeanUnicodeInputConfig = {}): Extension {
  // The table is the same for every editor this extension ends up in.
  const provider = new AbbreviationProvider(resolveConfig(config));
  const plugin = ViewPlugin.define(
    (view) => new AbbreviationPlugin(view, config, provider),
    { decorations: (instance) => instance.decorations }
  );
  return [
    plugin,
    // Listeners run once the update is complete, which is when the engine
    // may dispatch its replacements.
    EditorView.updateListener.of((update) => {
      const session = update.view.plugin(plugin)?.session;
      if (!session) return;
      void session.afterUpdate(update.docChanged, update.selectionSet);
      // VS Code replaces everything when the editor is switched away from.
      if (update.focusChanged && !update.view.hasFocus) void session.convertAll();
    }),
    // Only takes Tab while an abbreviation is being typed. Highest
    // precedence, because the editor's own Tab binding would otherwise
    // indent instead.
    Prec.highest(keymap.of([{ key: "Tab", run: convertLeanAbbreviations }])),
    abbreviationTheme,
  ];
}
