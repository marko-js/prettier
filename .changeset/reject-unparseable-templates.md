---
"prettier-plugin-marko": patch
---

Fail with the parser's syntax error instead of printing a template htmljs-parser could not parse. The parser stops at its first error, so formatting such a file used to print only the part before it and silently delete the rest.
