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
});
