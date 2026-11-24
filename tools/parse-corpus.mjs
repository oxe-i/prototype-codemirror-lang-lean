#!/usr/bin/env bun

// Development helper: parse a tree of .lean files with the grammar in
// src/syntax.grammar and report every error node the parser produces.
//
// The test/cases files check that individual constructs produce the right tree;
// this checks that a large body of real Lean produces no errors at all, and no
// `Unknown` tokens either — an `Unknown` means a character the tokenizer has no
// rule for, which an error count alone would not reveal. Point it at a checkout
// of the Exercism Lean track, or at Lean's own src/Init and src/Std.
//
//   bun tools/parse-corpus.mjs <dir-or-file>...

import * as fs from "fs";
import * as path from "path";
// The grammar's external tokenizers are TypeScript, hence bun.
import { parser } from "../test/parser.ts";

const roots = process.argv.slice(2);
if (roots.length === 0) {
  console.error("usage: bun tools/parse-corpus.mjs <dir-or-file>...");
  process.exit(2);
}

function* leanFiles(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    if (target.endsWith(".lean")) yield target;
    return;
  }
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    yield* leanFiles(path.join(target, entry.name));
  }
}

function lineAndColumn(source, offset) {
  const before = source.slice(0, offset);
  const line = before.split("\n").length;
  return `${line}:${offset - before.lastIndexOf("\n")}`;
}

let files = 0;
let failures = 0;

const unknowns = new Map();

for (const root of roots) {
  for (const file of leanFiles(root)) {
    files += 1;
    const source = fs.readFileSync(file, "utf8");
    const errors = [];
    parser.parse(source).iterate({
      enter: (node) => {
        if (node.type.isError) errors.push(node.from);
        if (node.name === "Unknown") {
          const text = source.slice(node.from, node.to);
          unknowns.set(text, (unknowns.get(text) ?? 0) + 1);
        }
      },
    });
    if (errors.length > 0) {
      failures += 1;
      for (const offset of errors.slice(0, 5)) {
        const excerpt = source.slice(offset, source.indexOf("\n", offset) + 1 || undefined);
        console.log(`${file}:${lineAndColumn(source, offset)}: ${excerpt.trim()}`);
      }
      if (errors.length > 5) {
        console.log(`${file}: ... and ${errors.length - 5} more`);
      }
    }
  }
}

if (unknowns.size > 0) {
  const worst = [...unknowns].sort((a, b) => b[1] - a[1]).slice(0, 20);
  console.log(
    `\nUnknown tokens: ${worst.map(([t, n]) => `${JSON.stringify(t)} x${n}`).join(", ")}`
  );
}

console.log(
  `\n${files} file(s) parsed, ${failures} with errors, ` +
    `${unknowns.size} distinct unknown token(s)`
);
process.exit(failures === 0 && unknowns.size === 0 ? 0 : 1);
