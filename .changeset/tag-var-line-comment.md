---
"prettier-plugin-marko": patch
---

Move a line comment that ends a tag var into a block comment (`<let/count // total` becomes `<let/count /* total */`), since a line comment there swallowed the rest of the open tag and a tag var cannot be parenthesized.
