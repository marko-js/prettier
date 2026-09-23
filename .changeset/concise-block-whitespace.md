---
"prettier-plugin-marko": patch
---

Keep the whitespace that renders beside a tag: before an inline tag inside a concise `---` block, and beside any tag when printing concise output, where a tag's own line is not whitespace. Indentation-only lines inside a `---` block no longer leave a stray space before a closing tag.
