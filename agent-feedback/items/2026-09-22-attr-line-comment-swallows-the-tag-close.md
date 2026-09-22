---
type: bug
impact: med
effort: med
site: src/index.ts › printHandlers[NodeType.AttrNamed]
---

# Break before the tag close when an exactly printed attr ends in a line comment

The exact print of an attr includes a trailing `//` comment, and `printTag` then closes the tag on the same line, so `<custom-tag\n  id="hello" // this comment should not be removed\n/>` collapses to `<custom-tag id="hello" // this comment should not be removed/>` — the `/>` is inside the comment and the template stops parsing as that tag. This only happens when no JS parser is available and the embed handlers fall back to `printExact`, which is the path the docs site takes (`prettier/standalone`, no parser plugin). A hard line before the close when an attr's exact text ends in a line comment would keep the output parseable; `src/__tests__/fixtures/attr-with-comment-short` is the input.

Check: format `src/__tests__/fixtures/attr-with-comment-short/template.marko` through `prettier/standalone` with only this plugin; `@marko/compiler` rejects the result with a `CompileError`, while the same input formatted through `prettier` (with `babel`) compiles to the same text as the source.
