import { buildParser } from "@lezer/generator";
import { fileTests } from "@lezer/generator/dist/test";

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { describe, expect, test } from "bun:test";
import { makeInterpPrefixTokenizer } from "../src/interp-prefix";
import {
  makeStdNamespaceTokenizer,
  makeStdTypeNameTokenizer,
} from "../src/std-namespace";

const caseDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "cases"
);
const parser = buildParser(
  fs.readFileSync(path.join("src", "syntax.grammar"), "utf8"),
  {
    externalTokenizer(name, terms) {
      if (name === "interpPrefixToken")
        return makeInterpPrefixTokenizer(terms.InterpPrefix);
      if (name === "stdNamespaceToken")
        return makeStdNamespaceTokenizer(terms.StdNamespace);
      if (name === "stdTypeNameToken")
        return makeStdTypeNameTokenizer(terms.StdTypeName);
      throw new Error(`Unknown external tokenizer: ${name}`);
    },
  }
);

for (const file of fs.readdirSync(caseDir)) {
  if (!/\.txt$/.test(file)) continue;

  const name = /^[^\.]*/.exec(file)![0];
  describe(name, () => {
    const contents = fs.readFileSync(path.join(caseDir, file), "utf8");
    for (const { name, run } of fileTests(contents, file))
      test(name, () => run(parser));
  });
}

describe("InterpPrefix span", () => {
  // The fixture-based tests above only check tree shape, not exact
  // character spans, so they wouldn't catch the prefix and the opening
  // quote drifting back together into one node.
  test("covers only the two prefix letters, not the opening quote", () => {
    const text = 's!"hi"';
    const tree = parser.parse(text);
    const cursor = tree.cursor();
    while (cursor.name !== "InterpPrefix") {
      if (!cursor.next()) throw new Error("InterpPrefix node not found");
    }
    expect(text.slice(cursor.from, cursor.to)).toBe("s!");
  });
});

describe("StdQualifiedType", () => {
  function nodeNames(text: string): string[] {
    const tree = parser.parse(text);
    const names: string[] = [];
    tree.iterate({ enter: (n) => void names.push(n.type.name) });
    return names;
  }

  test("splits Std and the curated type into separate nodes", () => {
    const text = "Std.TreeSet";
    const tree = parser.parse(text);
    const cursor = tree.cursor();
    while (cursor.name !== "StdNamespace") {
      if (!cursor.next()) throw new Error("StdNamespace node not found");
    }
    expect(text.slice(cursor.from, cursor.to)).toBe("Std.");
    while (cursor.name !== "StdTypeName") {
      if (!cursor.next()) throw new Error("StdTypeName node not found");
    }
    expect(text.slice(cursor.from, cursor.to)).toBe("TreeSet");
  });

  test("leaves a trailing method call as plain Operator + Identifier", () => {
    expect(nodeNames("Std.TreeSet.empty")).toEqual([
      "Program",
      "StdQualifiedType",
      "StdNamespace",
      "StdTypeName",
      "Operator",
      "Identifier",
    ]);
  });

  test("falls back to plain Identifier when the segment after Std. isn't curated", () => {
    expect(nodeNames("Std.foo")).toEqual(["Program", "Identifier"]);
  });

  test("falls back to plain Identifier for bare Std, e.g. `open Std`", () => {
    expect(nodeNames("open Std")).toEqual(["Program", "Keyword", "Identifier"]);
  });

  test("does not fire on an identifier that merely starts with Std", () => {
    expect(nodeNames("StdLib.foo")).toEqual(["Program", "Identifier"]);
  });

  test("does not affect the existing single-level QualifiedType feature", () => {
    expect(nodeNames("Nat.succ")).toEqual(["Program", "QualifiedType"]);
    expect(nodeNames("IO.println")).toEqual(["Program", "QualifiedType"]);
  });
});
