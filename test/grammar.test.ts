import { buildParser } from "@lezer/generator";
import { fileTests } from "@lezer/generator/dist/test";

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { describe, expect, test } from "bun:test";
import { makeInterpPrefixTokenizer } from "../src/interp-prefix";

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
