---
"prettier-plugin-marko": patch
---

Stop doubling every backslash in text content on each format. Only a backslash run that borders a placeholder is escaped now, so text like `C:\Users` or `\d+` keeps its backslashes and formatting it again is a no-op.
