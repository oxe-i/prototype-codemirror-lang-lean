import { buildParser } from "@lezer/generator";
import * as fs from "fs";
import * as path from "path";
import { makeInterpPrefixTokenizer } from "../src/interp-prefix";
import {
  makeStdNamespaceTokenizer,
  makeStdTypeNameTokenizer,
} from "../src/std-namespace";
import { makeQualifiedTypeTokenizer } from "../src/qualified-type";

// The parser, built straight from the grammar source so the tests don't
// depend on a prior `rollup` build. Shared by every test file that needs to
// parse Lean.
export const parser = buildParser(
  fs.readFileSync(path.join("src", "syntax.grammar"), "utf8"),
  {
    externalTokenizer(name, terms) {
      if (name === "interpPrefixToken")
        return makeInterpPrefixTokenizer(terms.InterpPrefix);
      if (name === "stdNamespaceToken")
        return makeStdNamespaceTokenizer(terms.StdNamespace);
      if (name === "stdTypeNameToken")
        return makeStdTypeNameTokenizer(terms.StdTypeName);
      if (name === "qualifiedTypeToken")
        return makeQualifiedTypeTokenizer(terms.QualifiedType);
      throw new Error(`Unknown external tokenizer: ${name}`);
    },
  }
);
