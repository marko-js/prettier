# Suspected Bugs

Out-of-scope defects noticed while working on something else. Format and rules: [README.md](README.md).

## Make `toValidBlock` decide braces from printed output, not from `breakParent` placement

`src/utils/to-valid-doc.ts` › `toValidBlock` | 2026-07-23 | impact:low | effort:med

`toValidBlock` wraps a scriptlet/statement in `{}` via `ifBreak`, so the brace decision is
whatever the enclosing group decides — which depends on where the embedded JS printer put its
`breakParent` nodes, not on how the code actually prints. Prettier's estree printer emits a
comment-only program as `[[["// c"]], [hardline, breakParent]]`, and `stripTrailingHardline`
removes the whole tail, so `$ { // c }` collapses to `$ // c`. A printer that emits the comment
as `[lineSuffix("// c"), breakParent, hardline, breakParent]` (oxc's `oxc_formatter`, reached
when a plugin such as `prettier-plugin-oxfmt` overrides the `babel-ts` parser) keeps the first
`breakParent` after the strip, so the group breaks and the braces stay. Both outputs are valid
Marko, but the plugin should not be sensitive to that. Consider deciding from
`printDoc(doc)` (already computed for the validity check) instead of `ifBreak`.
Re-verify: format `$ {\n  // just one\n}\n` with and without a plugin that overrides `babel-ts`
and compare — currently `$ // just one` vs `$ {\n  // just one\n}`.

## `issue-12` fixture depends on Babel accepting a rest element followed by a trailing comma

`src/__tests__/fixtures/issue-12/template.marko` | 2026-07-23 | impact:low | effort:low

The fixture's tag var is `{ greeting = "Hello", firstName, lastName, ...otherAttrs, }` — a rest
element followed by a trailing comma, which is a SyntaxError per spec. Babel parses it anyway, so
the plugin's `TagVar` handler (`src/index.ts`) formats it and silently drops the invalid comma,
making the snapshot assert that Prettier repairs invalid input. Spec-compliant parsers (oxc, and
therefore `oxfmt`) reject it; `textToDoc` throws, Prettier's multiparser swallows the error, and
the tag var falls back to unformatted source. Consider either fixing the fixture to valid syntax
and adding a separate `.skip.` fixture for the invalid form, or documenting the repair as intended.
Re-verify: `node -e 'require("@babel/parser").parse("var {a,...b,}=_")'` succeeds while the same
input fails in a spec-compliant parser.

## `prettier-plugin-tailwindcss`'s Marko transform still targets the pre-v4 AST

`src/parser.ts` › `parse` | 2026-07-23 | impact:med | effort:low

`prettier-plugin-tailwindcss` registers a `marko` transform (`transformMarko` in its bundle) that
walks nodes by string `type`: `File`, `Program`, `MarkoTag`, `MarkoTagBody`, `MarkoAttribute` —
the `@marko/compiler` Babel AST this plugin emitted through v3. v4's `Builder` emits its own tree
whose `type` is the numeric `NodeType` enum, so no case ever matches and classes are silently left
unsorted; there is no error, so it looks like Tailwind support simply does nothing. Either publish
a mapping the transform can consume or send a PR upstream teaching it the v4 `NodeType` shape.
Re-verify: `prettier --parser=marko --plugin=prettier-plugin-marko --plugin=prettier-plugin-tailwindcss`
on `<div class="p-4 flex bg-red-500 text-white">hi</div>` leaves the order untouched, while the
same input through the `html` or `svelte` parsers sorts to `flex bg-red-500 p-4 text-white`.

## Top-level imports are formatted one statement at a time, blocking import sorting

`src/index.ts` › `embedHandlers` | 2026-07-23 | impact:low | effort:med

The `NodeType.Import` embed handler calls `toDoc(read(node), stmtParse)` per import node, so an
embedded JS formatter only ever sees one import at a time. Any whole-program transform is
therefore impossible for Marko files — notably import sorting, which works for Vue/Svelte because
their `<script>` block reaches the formatter as a single program. Users combining this plugin with
a sorting plugin (or with `oxfmt`, whose `sortImports` silently no-ops on `.marko`) get no sorting
and no warning. Consider passing the leading run of `Import` nodes to `toDoc` as one program and
splitting the resulting doc, or documenting the limitation.
Re-verify: format a `.marko` file whose first lines are `import z from "z";` then `import a from "a";`
with any import-sorting tool enabled — the order is unchanged.
