---
"prettier-plugin-marko": patch
---

Keep comments inside an open tag, which were deleted before. A comment stays in its place among the tag's attrs, on its own line or after the part it followed. A line comment that has to share its line with more of the tag is printed as a block comment, and a comma is printed after a value that a comment follows, which would otherwise read the comment as part of it.
