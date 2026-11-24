import { StdNamespace, StdTypeName } from "./syntax.grammar.terms";
import { makeStdNamespaceTokenizer, makeStdTypeNameTokenizer } from "./std-namespace";

export const stdNamespaceToken = makeStdNamespaceTokenizer(StdNamespace);
export const stdTypeNameToken = makeStdTypeNameTokenizer(StdTypeName);
