import { parser } from "./syntax.grammar";
import {
  LRLanguage,
  LanguageSupport,
  foldInside,
  foldNodeProp,
  indentNodeProp,
} from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";
import { leanIndent } from "./indent";
import { leanUnicodeInput } from "./unicode-input";
import type { LeanUnicodeInputConfig } from "./unicode-input";

export {
  leanUnicodeInput,
  convertLeanAbbreviations,
  abbreviationHintAt,
} from "./unicode-input";
export type {
  LeanUnicodeInputConfig,
  AbbreviationHint,
} from "./unicode-input";

export const leanLanguage = LRLanguage.define({
  name: "lean",
  parser: parser.configure({
    props: [
      styleTags({
        // Modifiers (`private`, `partial`, …) are a node of their own but
        // share the keyword tag: that is how VS Code's stock themes show
        // them, and `t.modifier` would give them the colour of a type name
        // in Exercism's dark theme (One Dark), where types should stand out.
        "Keyword SymbolKeyword InterpKeyword Modifier": t.keyword,
        // The name a declaration introduces, as in `def add`. Not every
        // such name is a function (`structure Point`), but the Lean 4 VS
        // Code extension's grammar calls them all `entity.name.function`.
        "DefinitionName/Identifier": t.function(t.definition(t.variableName)),
        // `@[simp]` and the list of `attribute [simp]`, as one unit: the
        // `!` keeps what is inside from being styled on its own.
        "Attribute!": t.meta,
        Incomplete: t.invalid,
        HashCommand: t.meta,
        "Sort TypeName StdTypeName": t.typeName,
        "QualifiedType StdNamespace": t.namespace,
        BooleanLiteral: t.bool,
        Identifier: t.variableName,
        NameLiteral: t.atom,
        "String RawString StringInterp InterpolatedString": t.string,
        "InterpPrefix InterpBraceStart": t.meta,
        Char: t.character,
        "Escape CharEscape InterpEscape": t.escape,
        Number: t.number,
        Scientific: t.float,
        LineComment: t.lineComment,
        "BlockComment NestedComment": t.blockComment,
        "DocComment ModuleDoc": t.docComment,
        "Operator [ ]": t.operator,
        "( )": t.paren,
        "{ }": t.brace,
        "⟨ ⟩": t.bracket,
        // InterpBraces closes with the same "}" token ordinary Braces
        // does (see the grammar comment on InterpBraces for why), so this
        // more specific, parent-scoped rule is what makes it read as part
        // of the interpolation instead of an ordinary brace — it takes
        // priority over the generic "{ }" rule above for this one case.
        "InterpBraces/}": t.meta,
      }),
      // One rule for every node, so that neither the bracket-aligning
      // default for delimited nodes nor the column-0 default for the top
      // node applies. See `leanIndent`.
      indentNodeProp.add(() => leanIndent),
      foldNodeProp.add({
        "Parens Brackets Braces Anonymous": foldInside,
        "BlockComment DocComment ModuleDoc": foldInside,
      }),
    ],
  }),
  languageData: {
    commentTokens: {
      line: "--",
      block: { open: "/-", close: "-/" },
    },
    closeBrackets: {
      brackets: ["(", "[", "{", "⟨", '"'],
      // A quote typed right after a word is not closed, unless the word is
      // one of these. `!` counts as part of a word here, see `wordChars`.
      stringPrefixes: ["s!", "f!", "m!", "r"],
    },
    // `x'`, `get!` and `find?` are names, so a double click, word motion and
    // whole-word search take each as one word. The Lean 4 VS Code extension
    // does this with its `wordPattern`.
    wordChars: "'!?",
  },
});

export interface LeanConfig {
  /// Lean's `\`-abbreviations (`\to` → `→`), as in VS Code. On by default;
  /// pass `false` to leave them out, or an object to configure them.
  unicodeInput?: boolean | LeanUnicodeInputConfig;
}

export function lean(config: LeanConfig = {}) {
  const { unicodeInput = true } = config;
  return new LanguageSupport(
    leanLanguage,
    unicodeInput === false
      ? []
      : [leanUnicodeInput(unicodeInput === true ? {} : unicodeInput)]
  );
}
