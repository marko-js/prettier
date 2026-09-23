---
"prettier-plugin-marko": patch
---

Print code copied from source validly, which happens without a JS parser (`prettier/standalone`) or when the code fails to parse: shorthand methods keep their `async`, scriptlets keep their `$`, and an attribute value that ends in a line comment or spans lines is enclosed rather than swallowing or splitting the rest of the tag.
