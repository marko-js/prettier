---
type: bug
impact: high
effort: med
site: src/index.ts › printBody
---

# Keep a separator before a `/* */` body comment so it stays a comment

In `printBody` a non-line comment is marked `inlineChild` whenever the preceding child was inline, so a `/* */` comment that followed a tag or a placeholder is pushed into the same fill with no separator at all. htmljs-parser only starts a comment at a content boundary, so the joined result re-parses as text and the comment is rendered into the page: `<div>\n  <span/>\n  /* c */\n</div>` compiles to `_html("<div><span></span></div>")` and formats to `<div><span/>/* c */</div>`, which compiles to `_html("<div><span></span>/* c */</div>")`. The rewrite is idempotent, so `--check` goes green on the corrupted file and nothing reports the loss. The `<!-- -->` form survives because its delimiter needs no boundary, and the same input in concise mode is left alone, so the fix is narrow: when the comment is `/* */` and the fill does not already end in a line, keep a separator (or leave it out of the fill). The 4.0.8 note "only consider a comment inline text if it was preceded by inline text" is the rule that wants tightening — a `Tag` or `Placeholder` sibling is inline but is not text.

Check: `printf '<div>\n  <span/>\n  /* c */\n</div>\n' > /tmp/x.marko && pnpm run build && pnpm exec prettier --write --plugin ./dist/index.mjs /tmp/x.marko` prints `<div><span/>/* c */</div>`, whose compiled markup is `<div><span></span>/* c */</div>` against the input's `<div><span></span></div>`; expect the comment to stay a comment.
