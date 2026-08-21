---
type: bug
impact: high
effort: med
site: src/utils/visible-space.ts › ensureVisibleSpace
---

# Stop turning the whitespace beside a comment into `${" "}`

`printBody` folds a block comment into the current inline fill whenever the previous child was inline, and `ensureVisibleSpace` then rewrites a leading or trailing `b.line` of that fill into `${" "}` so the space survives a re-parse. Whitespace next to a Marko comment is not significant — the comment is erased at compile time — so the escape materialises a space that was never rendered: `<div>\n  <!-- c -->\n  x\n</div>` compiles to `_html("<div>x</div>")` and its formatted form `<div>\n  <!-- c -->\n  ${" "}x\n</div>` compiles to `_html("<div> x</div>")`, with the mirror shape (`x` then the comment) yielding `<div>x </div>`. The one-line form `<div><!--c-->text</div>` is worse to review because pass 1 is faithful and pass 2 introduces the space, so a clean diff turns into a changed page on the next contributor's format run. The guard belongs where the fill boundary is computed: a `b.line` that only ever separated content from a comment must stay a `b.line`. A related shape shows the escape is unsafe after any literal `<` too — `<div>< </div>` becomes `<div><${" "}</div>`, where `<` + `${` reads as a dynamic-tag opener and `@marko/compiler` fails with `EOF reached while parsing open tag` while prettier exits 0.

Check: format `<div>\n  <!-- c -->\n  x\n</div>` with `pnpm exec prettier --plugin ./dist/index.mjs --parser marko` and compile input and output with `@marko/compiler`; today the emitted markup goes from `<div>x</div>` to `<div> x</div>`, and it should be byte-identical.
