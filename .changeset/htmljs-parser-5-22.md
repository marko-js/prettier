---
"prettier-plugin-marko": patch
---

Require htmljs-parser 5.22, matching the Marko compiler, which fixes several misparses (regular expressions after keywords like `return`, escaped quotes and regular expressions in `<script>` bodies, `<!-- a->b -->` comments, spaced non-null `!` assertions, attribute values starting with a comment, and unfinished concise constructs at EOF).
