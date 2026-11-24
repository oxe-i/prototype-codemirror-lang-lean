import { InterpPrefix } from "./syntax.grammar.terms";
import { makeInterpPrefixTokenizer } from "./interp-prefix";

export const interpPrefixToken = makeInterpPrefixTokenizer(InterpPrefix);
