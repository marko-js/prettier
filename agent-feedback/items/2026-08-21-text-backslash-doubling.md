---
type: bug
impact: high
effort: med
site: src/index.ts › printHandlers[NodeType.Text]
---

# Escape only the backslashes that could swallow a following placeholder

The `Text` handler is `read(path.node, opts).replace(/\\/g, "\\\\")`, so it doubles every backslash in text content, but htmljs-parser only consumes a backslash as an escape when the run leads into `${` or `$!{`: parsing `<div>a\b</div>` yields one `Text` range spanning `a\b`, while `<div>\\${x}</div>` yields `Text` `\` plus a live `Placeholder`. Doubling unconditionally therefore has no fixed point — a Windows path, a LaTeX fragment or a regexp in prose grows 1, 2, 4, 8 backslashes over successive `--write` runs, so `prettier --check` can never go green on that file — and it is not merely cosmetic: `@marko/compiler` emits `_html("<div>a\\b</div>")` before and `_html("<div>a\\\\b</div>")` after, so the page really renders the extra backslash. The escape only needs to cover a backslash run immediately preceding a placeholder boundary, which is what `src/__tests__/fixtures/placeholders-body-double-escaped` pins; `text-content-backslashes` looks like coverage but its body is inside `<html-script>`, which `hasTagParser` routes to `embedHandlers` so no `Text` node reaches this handler, leaving plain text content with no fixture at all. Concise `--` bodies and `<pre>` are hit the same way — `hasPreservedText` does not exempt them; attribute strings and `<script>`/`<style>` are not.

Check: `printf '<p>Path: C:\\Users\\dev</p>\n' > /tmp/x.marko && pnpm run build && pnpm exec prettier --write --plugin ./dist/index.mjs /tmp/x.marko` run three times prints `C:\\Users\\dev`, then `C:\\\\Users\\\\dev`, then `C:\\\\\\\\Users\\\\\\\\dev`; expect the second run to leave the file byte-identical to the first.
