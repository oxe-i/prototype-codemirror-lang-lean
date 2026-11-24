import { QualifiedType } from "./syntax.grammar.terms";
import { makeQualifiedTypeTokenizer } from "./qualified-type";

export const qualifiedTypeToken = makeQualifiedTypeTokenizer(QualifiedType);
