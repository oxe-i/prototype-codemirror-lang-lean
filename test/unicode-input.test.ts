import { describe, expect, test } from "bun:test";
import { abbreviations, matchAbbreviation } from "../src/unicode-input";

describe("abbreviations table", () => {
  test("is prefix-free, so a match can fire the moment it's typed", () => {
    const keys = Object.keys(abbreviations);
    for (const a of keys) {
      for (const b of keys) {
        if (a !== b) expect(b.startsWith(a)).toBe(false);
      }
    }
  });
});

describe("matchAbbreviation", () => {
  test("matches a short abbreviation right after it's completed", () => {
    expect(matchAbbreviation("\\to")).toEqual({ matchLength: 3, symbol: "→" });
  });

  test("matches a longer abbreviation with preceding text on the line", () => {
    expect(matchAbbreviation("theorem t : p \\and")).toEqual({
      matchLength: 4,
      symbol: "∧",
    });
  });

  test("matches right after the cursor, ignoring earlier words", () => {
    expect(matchAbbreviation("x \\in")).toEqual({
      matchLength: 3,
      symbol: "∈",
    });
  });

  test("returns null for an incomplete abbreviation", () => {
    expect(matchAbbreviation("\\an")).toBeNull();
  });

  test("returns null for an unknown abbreviation", () => {
    expect(matchAbbreviation("\\xyz")).toBeNull();
  });

  test("returns null when there is no trailing backslash sequence", () => {
    expect(matchAbbreviation("hello")).toBeNull();
    expect(matchAbbreviation("")).toBeNull();
  });

  test("matches a single-letter number-system shortcut", () => {
    expect(matchAbbreviation("f : \\R")).toEqual({ matchLength: 2, symbol: "ℝ" });
  });

  test("matches a greek letter", () => {
    expect(matchAbbreviation("\\pi")).toEqual({ matchLength: 3, symbol: "π" });
  });

  test("does not expand \\in as a prefix of the intentionally-omitted \\infty", () => {
    // \infty isn't in the table (it would conflict with \in), so typing
    // toward it should expand at \in and leave the rest as plain text.
    expect(matchAbbreviation("\\in")).toEqual({ matchLength: 3, symbol: "∈" });
    expect(matchAbbreviation("\\inf")).toBeNull();
  });
});
