---
"prettier-plugin-marko": patch
---

Parse templates with the shared `@marko/parse` package instead of a vendored syntax tree builder; `htmljs-parser` is no longer a direct dependency.
