---
type: bug
impact: med
effort: low
site: src/index.ts › printBody
---

# Keep the space between two placeholders visible when the fill breaks there

In HTML-mode text, `printBody` turns the space in `${a} ${b}` into a plain `b.line`, and its `NodeType.Placeholder` case has no counterpart to the `ensureVisibleSpaceBetweenTags` call the `NodeType.Tag` case makes, so when the fill breaks at that line the printer puts `${a}` and `${b}` on separate lines. Marko drops whitespace that contains a line break between two placeholders, as it does between two tags, so formatting changes the page from `ALPHA BETA files` to `ALPHABETA files`, and the next pass prints the glued form (`${a}${` / `b` / `} files`), so the printer is not idempotent either. `2026-08-21-concise-text-wrap-after-placeholder.md` calls the HTML-mode wrap safe, which holds for text after a placeholder but not for a placeholder after a placeholder. Give a `b.line` between two placeholders the same `ifBreak` visible space `ensureVisibleSpaceBetweenTags` gives one before a tag, or never break between two adjacent placeholders.

Check: `pnpm run build`, then format `<div>\n  <p>${firstPlaceholderValue.toUpperCase()} ${secondPlaceholderValue.toUpperCase()} files</p>\n</div>` with `pnpm exec prettier --plugin ./dist/index.mjs --parser marko`: the output puts each placeholder on its own line, and compiling input and output with `@marko/compiler` (`output: "html"`) goes from `<p>${_escape(first…)} ${_escape(second…)} files</p>` to `<p>${_escape(first…)}${_escape(second…)} files</p>`; formatting the output again changes it once more. Both should be no-ops.
