import { fileTests } from "@lezer/generator/dist/test";

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { describe, expect, test } from "bun:test";
import { parser } from "./parser";

const caseDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "cases"
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

  test("takes a namespace under Std along when one of its types follows", () => {
    const text = "Std.Time.PlainDateTime";
    const tree = parser.parse(text);
    const cursor = tree.cursor();
    while (cursor.name !== "StdNamespace") {
      if (!cursor.next()) throw new Error("StdNamespace node not found");
    }
    expect(text.slice(cursor.from, cursor.to)).toBe("Std.Time.");
    while (cursor.name !== "StdTypeName") {
      if (!cursor.next()) throw new Error("StdTypeName node not found");
    }
    expect(text.slice(cursor.from, cursor.to)).toBe("PlainDateTime");
    expect(nodeNames("Std.Time.PlainDate.mk 2011 4 25")).toEqual([
      "Program",
      "StdQualifiedType",
      "StdNamespace",
      "StdTypeName",
      "Operator",
      "Identifier",
      "Number",
      "Number",
      "Number",
    ]);
  });

  test("leaves Std.Time alone when no known type follows", () => {
    // The module, a name the list doesn't have, a longer name that only
    // starts like a listed one, and a Std.Time type without its namespace.
    for (const text of [
      "Std.Time",
      "Std.Time.Foo",
      "Std.Time.PlainDateTimes",
      "Std.Duration",
      "Lean.Time.PlainDate",
      "Std.Data.HashMap",
    ]) {
      expect(nodeNames(text)).toEqual(["Program", "Identifier"]);
    }
    expect(nodeNames("import Std.Time")).toEqual([
      "Program",
      "Keyword",
      "Identifier",
    ]);
  });

  test("does not colour a bare Std.Time type name", () => {
    expect(nodeNames("Duration Timestamp WallTime")).toEqual([
      "Program",
      "Identifier",
      "Identifier",
      "Identifier",
    ]);
  });

  test("splits Lean and a curated type the same way", () => {
    const text = "Lean.TSyntax";
    const tree = parser.parse(text);
    const cursor = tree.cursor();
    while (cursor.name !== "StdNamespace") {
      if (!cursor.next()) throw new Error("StdNamespace node not found");
    }
    expect(text.slice(cursor.from, cursor.to)).toBe("Lean.");
    expect(nodeNames("Lean.MacroM Lean.Syntax")).toEqual([
      "Program",
      "StdQualifiedType",
      "StdNamespace",
      "StdTypeName",
      "StdQualifiedType",
      "StdNamespace",
      "StdTypeName",
    ]);
    // Not in the list, a longer word, and the bare namespace.
    for (const text of ["Lean.Name", "Leans.Syntax", "Lean", "Lean.Elab.Command"]) {
      expect(nodeNames(text)).toEqual(["Program", "Identifier"]);
    }
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
      "DefinitionName",
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
