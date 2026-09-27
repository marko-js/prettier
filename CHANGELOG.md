# prettier-plugin-marko

## 4.1.4

### Patch Changes

- [#156](https://github.com/marko-js/prettier/pull/156) [`e72ec04`](https://github.com/marko-js/prettier/commit/e72ec04cce6ca1c674d6f174e717e0afa8ba9909) Thanks [@DylanPiercey](https://github.com/DylanPiercey)! - Keep the whitespace that renders beside a tag: before an inline tag inside a concise `---` block, and beside any tag when printing concise output, where a tag's own line is not whitespace. Indentation-only lines inside a `---` block no longer leave a stray space before a closing tag.

## 4.1.3

### Patch Changes

- [#154](https://github.com/marko-js/prettier/pull/154) [`d0ef393`](https://github.com/marko-js/prettier/commit/d0ef3937532e3add2e34dc4da53c61351312b558) Thanks [@DylanPiercey](https://github.com/DylanPiercey)! - Keep comments inside an open tag, which were deleted before. A comment stays in its place among the tag's attrs, on its own line or after the part it followed. A line comment that has to share its line with more of the tag is printed as a block comment, and a comma is printed after a value that a comment follows, which would otherwise read the comment as part of it.

- [#153](https://github.com/marko-js/prettier/pull/153) [`da5a821`](https://github.com/marko-js/prettier/commit/da5a821bd9bd04dac7dd0af35df305bdb0058aab) Thanks [@DylanPiercey](https://github.com/DylanPiercey)! - Move a line comment that ends a tag var into a block comment (`<let/count // total` becomes `<let/count /* total */`), since a line comment there swallowed the rest of the open tag and a tag var cannot be parenthesized.

## 4.1.2

### Patch Changes

- [#151](https://github.com/marko-js/prettier/pull/151) [`221d8ac`](https://github.com/marko-js/prettier/commit/221d8ac0377a07f0076011f93263a20c06d55164) Thanks [@DylanPiercey](https://github.com/DylanPiercey)! - Stop doubling every backslash in text content on each format. Only a backslash run that borders a placeholder is escaped now, so text like `C:\Users` or `\d+` keeps its backslashes and formatting it again is a no-op.

## 4.1.1

### Patch Changes

- [#150](https://github.com/marko-js/prettier/pull/150) [`81b16c8`](https://github.com/marko-js/prettier/commit/81b16c8ba9ca11124f4c788d2f83e28a640c2881) Thanks [@DylanPiercey](https://github.com/DylanPiercey)! - Print code copied from source validly, which happens without a JS parser (`prettier/standalone`) or when the code fails to parse: shorthand methods keep their `async`, scriptlets keep their `$`, and an attribute value that ends in a line comment or spans lines is enclosed rather than swallowing or splitting the rest of the tag.

- [#147](https://github.com/marko-js/prettier/pull/147) [`272ee0d`](https://github.com/marko-js/prettier/commit/272ee0dc951d44883cca4cebda4389cc1fd6de1c) Thanks [@DylanPiercey](https://github.com/DylanPiercey)! - Fail with the parser's syntax error instead of printing a template htmljs-parser could not parse. The parser stops at its first error, so formatting such a file used to print only the part before it and silently delete the rest.

## 4.1.0

### Minor Changes

- [#141](https://github.com/marko-js/prettier/pull/141) [`9bf9eeb`](https://github.com/marko-js/prettier/commit/9bf9eeb834876f3b6accaee5b3067c7480f8ff08) Thanks [@DylanPiercey](https://github.com/DylanPiercey)! - Print the `async` shorthand method modifier, eg `<button async onClick() { await save() }>`.

## 4.0.10

### Patch Changes

- [#131](https://github.com/marko-js/prettier/pull/131) [`4b9f3ab`](https://github.com/marko-js/prettier/commit/4b9f3ab5bb1a6de3e61fc94d7078c6d4ca05a1e6) Thanks [@DylanPiercey](https://github.com/DylanPiercey)! - Require htmljs-parser ^5.12.1, which fixes attribute-value trailing line comments being treated as self-enclosed and leaking past the tag.

## 4.0.9

### Patch Changes

- [#115](https://github.com/marko-js/prettier/pull/115) [`4739f68`](https://github.com/marko-js/prettier/commit/4739f68125ef59cf6625cbf5b713ddcc342156c3) Thanks [@LuLaValva](https://github.com/LuLaValva)! - Wrap tag param types with pipes in parentheses

## 4.0.8

### Patch Changes

- [#110](https://github.com/marko-js/prettier/pull/110) [`7a031a3`](https://github.com/marko-js/prettier/commit/7a031a3fb4f2ea233d2729495774422beaf81694) Thanks [@DylanPiercey](https://github.com/DylanPiercey)! - Preserve static block locations.

- [#110](https://github.com/marko-js/prettier/pull/110) [`7a031a3`](https://github.com/marko-js/prettier/commit/7a031a3fb4f2ea233d2729495774422beaf81694) Thanks [@DylanPiercey](https://github.com/DylanPiercey)! - Only consider a comment inline text if it was preceded by inline text.

## 4.0.7

### Patch Changes

- [#108](https://github.com/marko-js/prettier/pull/108) [`afedf85`](https://github.com/marko-js/prettier/commit/afedf85b974de3206b1324337ad34fadcfb27d8a) Thanks [@DylanPiercey](https://github.com/DylanPiercey)! - Fix issue with scriptlets being considered safe to avoid wrapping with brackets even when it was not.

## 4.0.6

### Patch Changes

- [#102](https://github.com/marko-js/prettier/pull/102) [`828a883`](https://github.com/marko-js/prettier/commit/828a8830b7a143573c79a44bbd39eddff0c3f3ad) Thanks [@DylanPiercey](https://github.com/DylanPiercey)! - Improve stripping of empty tag param, args, type params and type args.

## 4.0.5

### Patch Changes

- [#98](https://github.com/marko-js/prettier/pull/98) [`44cd960`](https://github.com/marko-js/prettier/commit/44cd960f43ea8ff02c86b3afdd3623d1f1e3afd3) Thanks [@LuLaValva](https://github.com/LuLaValva)! - preserve $!{} placeholders

## 4.0.4

### Patch Changes

- [#96](https://github.com/marko-js/prettier/pull/96) [`0702ae9`](https://github.com/marko-js/prettier/commit/0702ae9cf75d0ef007061ec607433ee445ba1b4b) Thanks [@DylanPiercey](https://github.com/DylanPiercey)! - Rewrite pretty printing logic to be more robust and leverage new parser.
