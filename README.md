# Lean language support for CodeMirror

![NPM Version](https://img.shields.io/npm/v/@exercism/codemirror-lang-lean)

This repo contains the grammar for the Lean 4 language.

Lean's syntax is user-extensible, so no fixed grammar can describe it. This one
highlights Lean's tokens — keywords, sorts and core types, literals, comments and
operators — and nests them inside balanced `()`, `[]`, `{}` and `⟨⟩` nodes so
that bracket matching, folding and indentation work. A catch-all token means no
input, however malformed, can stop the parse.

The lexical rules follow the Lean 4 sources: `src/Init/Meta/Defs.lean` for what
may appear in an identifier, and `src/Lean/Parser/Basic.lean` for comments,
strings, characters and numbers. The keyword list is drawn from
`src/Lean/Parser/{Command,Term,Do}.lean` plus the core tactics; being a curated
list rather than a closed one, it is the part most likely to need extending.

⚠️ To ensure that the package can be integrated on the Exercism website, don't change the packages' versions:

```json
"@codemirror/language": "^6.10.1",
"@lezer/highlight": "^1.2.0",
"@lezer/lr": "^1.4.0"
```

## Install

- NPM: `npm install @exercism/codemirror-lang-lean`
- Yarn: `yarn add @exercism/codemirror-lang-lean`
- Bun: `bun add @exercism/codemirror-lang-lean`

## Prerequisites

- [Bun](https://bun.sh/)

## Resources

- [CodeMirror](https://codemirror.net/docs/)
- [Lezer](https://lezer.codemirror.net/docs/guide/)
  - [Writing a Grammar](https://lezer.codemirror.net/docs/guide/#writing-a-grammar)
  - [Examples](https://lezer.codemirror.net/examples/)
  - [Existing grammar files](https://github.com/search?q=org%3Alezer-parser+path%3A%2F.grammar%24%2F&type=code)

## Structure

The repo's source files are defined in [TypeScript](https://www.typescriptlang.org/).

The repo is structured as follows:

```text
.
├── src
│   ├── index.ts (the main plugin)
│   ├── syntax.grammar (the Lezer grammar)
│   └── syntax.grammar.d.ts (the grammar typings)
├── test
│   ├── cases (test cases)
│   │   └ *.txt (test case)
│   └── grammar.test.ts (test file)
├── tools
│   └── parse-corpus.mjs (parses a tree of .lean files, dev only)
├── index.html (dev server file)
├── rollup.config.js (bundling config)
├── tsconfig.json (typescript confif)
└── vite.config.js (vite dev server config)
```

## Setup

Run `bun install` to install all dependencies.

## Developing

To help with development, run `bun run dev`.
This will start a [Vite](https://vite.dev/) dev server (usually at http://localhost:5173/) that renders the `index.html` file.
The `#editor` element gets populated with some sample source code of your choosing and then it will get transformed by the grammar defined in `src/syntax.grammar`.
Any changes to the grammar will auto-refresh the dev server's rendered contents.

## Testing

The `test/cases` directory contains the tests files.
Run `bun test` to run these tests.

Note: test (case) files should be relatively small and focus on a single aspect of a grammar.

For wider coverage, `tools/parse-corpus.mjs` parses every `.lean` file under the
directories you give it and reports both error nodes and `Unknown` tokens (a
character the tokenizer has no rule for):

```shell
node tools/parse-corpus.mjs ../lean/exercises
```

Point it at a checkout of the [Lean track][track], or at Lean's own `src/Init`
and `src/Std`.

[track]: https://github.com/exercism/lean

## Publishing

Run `bun publish` to publish the plugin to NPM.
