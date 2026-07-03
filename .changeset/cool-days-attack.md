---
"prettier-plugin-marko": patch
---

Require htmljs-parser ^5.12.1, which fixes attribute-value trailing line comments being treated as self-enclosed and leaking past the tag.
