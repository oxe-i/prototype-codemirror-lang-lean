import { parser } from "./syntax.grammar";
import {
  LRLanguage,
  LanguageSupport,
  delimitedIndent,
  foldInside,
  foldNodeProp,
  indentNodeProp,
} from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";
import { leanUnicodeInput } from "./unicode-input";
import type { LeanUnicodeInputConfig } from "./unicode-input";

export { leanUnicodeInput, convertLeanAbbreviations } from "./unicode-input";
export type { LeanUnicodeInputConfig } from "./unicode-input";

export const leanLanguage = LRLanguage.define({
  name: "lean",
  parser: parser.configure({
    props: [
      styleTags({
        "Keyword SymbolKeyword": t.keyword,
        HashCommand: t.meta,
        "Sort TypeName StdTypeName": t.typeName,
        "QualifiedType StdNamespace": t.namespace,
        BooleanLiteral: t.bool,
        Identifier: t.variableName,
        NameLiteral: t.atom,
        "String RawString StringInterp": t.string,
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
      indentNodeProp.add({
        Parens: delimitedIndent({ closing: ")" }),
        Brackets: delimitedIndent({ closing: "]" }),
        Braces: delimitedIndent({ closing: "}" }),
        Anonymous: delimitedIndent({ closing: "⟩" }),
      }),
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
    closeBrackets: { brackets: ["(", "[", "{", "⟨", '"'] },
    indentOnInput: /^\s*[\}\)\]⟩]$/,
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
