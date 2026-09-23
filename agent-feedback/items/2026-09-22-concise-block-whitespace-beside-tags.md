---
type: bug
impact: med
effort: med
site: src/index.ts › printBody
---

# Preserve rendered whitespace beside tags inside a concise `---` block

Inside a concise `---` block, the printer does not preserve how whitespace next to an inline HTML tag renders. `div\n  ---\n  a\n  <b>\n    x\n  </b>\n  ---\n` renders `<div>a <b> x</b></div>`, and its formatted form (`div\n  -- a\n  b -- ${" "}x`, or `<div>a<b>${" "}x</b></div>` with `markoSyntax: "html"`) renders `<div>a<b> x</b></div>`, so the space before the tag is lost. The `src/__tests__/fixtures/markdown` template shows the opposite shape: its `<h1>` renders `<h1> Hello …!</h1>` before formatting and `<h1> Hello …! </h1>` after. The fixture guard misses both because it compares text flattened across tags. Each whitespace run in the block needs to print as whatever renders the same after a re-parse (`${" "}` where a space is kept, nothing where the compiler drops it).

Check: format `div\n  ---\n  a\n  <b>\n    x\n  </b>\n  ---\n` with `pnpm exec prettier --plugin ./dist/index.mjs --parser marko`, then compile the input and the output with `@marko/compiler` (`output: "html"`); the rendered markup goes from `<div>a <b> x</b></div>` to `<div>a<b> x</b></div>`.
