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

export const leanLanguage = LRLanguage.define({
  name: "lean",
  parser: parser.configure({
    props: [
      styleTags({
        "Keyword SymbolKeyword": t.keyword,
        HashCommand: t.meta,
        "Sort TypeName": t.typeName,
        BooleanLiteral: t.bool,
        Identifier: t.variableName,
        NameLiteral: t.atom,
        "String RawString": t.string,
        Char: t.character,
        "Escape CharEscape": t.escape,
        Number: t.number,
        Scientific: t.float,
        LineComment: t.lineComment,
        "BlockComment NestedComment": t.blockComment,
        "DocComment ModuleDoc": t.docComment,
        Operator: t.operator,
        "( )": t.paren,
        "[ ]": t.squareBracket,
        "{ }": t.brace,
        "⟨ ⟩": t.bracket,
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

export function lean() {
  return new LanguageSupport(leanLanguage);
}
