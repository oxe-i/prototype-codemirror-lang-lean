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
import { makeQualifiedTypeTokenizer } from "../src/qualified-type";

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
      if (name === "qualifiedTypeToken")
        return makeQualifiedTypeTokenizer(terms.QualifiedType);
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

  test("does not affect the existing QualifiedType feature", () => {
    expect(nodeNames("Nat.succ")).toEqual(["Program", "QualifiedType", "Identifier"]);
    expect(nodeNames("IO.println")).toEqual(["Program", "QualifiedType", "Identifier"]);
  });
});

describe("QualifiedType", () => {
  function nodeNames(text: string): string[] {
    const tree = parser.parse(text);
    const names: string[] = [];
    tree.iterate({ enter: (n) => void names.push(n.type.name) });
    return names;
  }

  test("covers only the curated type name and the dot, not the method after it", () => {
    const text = "Nat.succ";
    const tree = parser.parse(text);
    const cursor = tree.cursor();
    while (cursor.name !== "QualifiedType") {
      if (!cursor.next()) throw new Error("QualifiedType node not found");
    }
    expect(text.slice(cursor.from, cursor.to)).toBe("Nat.");
  });

  test("leaves the method as a plain, unhighlighted Identifier", () => {
    expect(nodeNames("IO.println")).toEqual(["Program", "QualifiedType", "Identifier"]);
  });

  test("fires even with nothing valid after the dot, unlike StdNamespace", () => {
    expect(nodeNames("Nat.")).toEqual(["Program", "QualifiedType"]);
    expect(nodeNames("IO. foo")).toEqual(["Program", "QualifiedType", "Identifier"]);
  });

  test("only ever carves off one curated-name-plus-dot prefix, not further dots", () => {
    expect(nodeNames("Nat.Something.Else")).toEqual(["Program", "QualifiedType", "Identifier"]);
  });

  test("a dot right after a closing bracket is never mistaken for this", () => {
    expect(nodeNames("(x).toList")).toEqual([
      "Program",
      "Parens",
      "(",
      "Identifier",
      ")",
      "Operator",
      "Identifier",
    ]);
    expect(nodeNames("[1, 2].map")).toEqual([
      "Program",
      "Brackets",
      "[",
      "Number",
      "Operator",
      "Number",
      "]",
      "Operator",
      "Identifier",
    ]);
  });

  test("does not fire when the leading segment isn't curated", () => {
    expect(nodeNames("Complex.add")).toEqual(["Program", "Identifier"]);
  });
});

describe("InterpBraces", () => {
  function nodeNames(text: string): string[] {
    const tree = parser.parse(text);
    const names: string[] = [];
    tree.iterate({ enter: (n) => void names.push(n.type.name) });
    return names;
  }

  test("splits { and } off as their own nodes around real, nested code", () => {
    expect(nodeNames('s!"n = {n}"')).toEqual([
      "Program",
      "StringInterp",
      "InterpPrefix",
      "InterpBraces",
      "InterpBraceStart",
      "Identifier",
      "}",
    ]);
  });

  test("a nested s! string inside {...} is parsed and highlighted like any other", () => {
    // The motivating case: a nested interpolated string, itself containing
    // a further interpolation referencing a curated type.
    const text = 's!"Hello, {s!"{Nat.succ 2} of us"}"';
    expect(nodeNames(text)).toEqual([
      "Program",
      "StringInterp",
      "InterpPrefix",
      "InterpBraces",
      "InterpBraceStart",
      "StringInterp",
      "InterpPrefix",
      "InterpBraces",
      "InterpBraceStart",
      "QualifiedType",
      "Identifier",
      "Number",
      "}",
      "}",
    ]);
    // No error nodes anywhere in the tree.
    const tree = parser.parse(text);
    expect(tree.cursor().type.isError).toBe(false);
    let hasError = false;
    tree.iterate({ enter: (n) => void (hasError ||= n.type.isError) });
    expect(hasError).toBe(false);
  });

  test("an escaped brace does not open an interpolation", () => {
    expect(nodeNames('s!"literal: \\{ not interp"')).toEqual([
      "Program",
      "StringInterp",
      "InterpPrefix",
      "InterpEscape",
    ]);
  });

  test("empty interpolation {} is well-formed", () => {
    expect(nodeNames('s!"{}"')).toEqual([
      "Program",
      "StringInterp",
      "InterpPrefix",
      "InterpBraces",
      "InterpBraceStart",
      "}",
    ]);
  });

  test("does not affect ordinary Braces, including right after Number/Identifier", () => {
    expect(nodeNames("{ x := 1 }")).toEqual([
      "Program",
      "Braces",
      "{",
      "Identifier",
      "Operator",
      "Number",
      "}",
    ]);
    expect(nodeNames("def f : Nat := { x := 1 }.x")).toEqual([
      "Program",
      "Keyword",
      "Identifier",
      "Operator",
      "TypeName",
      "Operator",
      "Braces",
      "{",
      "Identifier",
      "Operator",
      "Number",
      "}",
      "Operator",
      "Identifier",
    ]);
  });

  test("a plain (non-interpolated) string with a literal brace is unaffected", () => {
    expect(nodeNames('"a {plain} string"')).toEqual(["Program", "String"]);
  });
});
