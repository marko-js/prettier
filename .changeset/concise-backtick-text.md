---
"prettier-plugin-marko": minor
---

Print concise text with backticks instead of `--`, leaving off the optional closing backticks. Leading and trailing whitespace is written between the backticks instead of as `${" "}`, and trailing whitespace on a single line is kept by closing backticks. Text on several lines beside sibling tags is closed by a line of the same backticks, as is a comment after text. The opening fence is longer than any run of backticks in the text, and text that starts with a backtick is printed as a block.

Keep the syntax each tag was written in with `markoSyntax: "auto"`, instead of formatting the whole file in the syntax of its first tag. An HTML tag inside concise text, like ``p `concise mode is <em>sort of</em> concise` ``, stays inline in the text.
