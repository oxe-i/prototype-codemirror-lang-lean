import { InterpKeyword, InterpPrefix } from "./syntax.grammar.terms";
import {
  makeInterpKeywordTokenizer,
  makeInterpPrefixTokenizer,
} from "./interp-prefix";

export const interpPrefixToken = makeInterpPrefixTokenizer(InterpPrefix);
export const interpKeywordToken = makeInterpKeywordTokenizer(InterpKeyword);
