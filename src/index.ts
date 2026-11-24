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

export const leanLanguage = LRLanguage.define({
  name: "lean",
  parser: parser.configure({
    props: [
      styleTags({
        "Keyword SymbolKeyword": t.keyword,
        HashCommand: t.meta,
        "Sort TypeName": t.typeName,
        QualifiedType: t.namespace,
        // Not t.definition(t.typeName)/t.definition(t.namespace): since the
        // keyword and the declared name are one token (see the grammar
        // comment on TypeDecl/NamespaceDecl), that would make the whole
        // span read as "a type/namespace reference", indistinguishable in
        // hue from TypeName/QualifiedType elsewhere. t.definition(t.variableName)
        // keeps it a properly distinct color — this is a name being
        // defined, not a type being referenced.
        "TypeDecl NamespaceDecl": t.definition(t.variableName),
        BooleanLiteral: t.bool,
        Identifier: t.variableName,
        NameLiteral: t.atom,
        "String RawString StringInterp": t.string,
        InterpPrefix: t.meta,
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
  return new LanguageSupport(leanLanguage, [leanUnicodeInput()]);
}
