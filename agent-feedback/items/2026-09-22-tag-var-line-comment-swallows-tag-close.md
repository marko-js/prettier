---
type: bug
impact: med
effort: low
site: src/index.ts › embedHandlers[NodeType.TagVar]
---

# Format a tag var that ends in a line comment

htmljs-parser folds a trailing `// comment` into the tag var's value, as it does for an attr value, which is how the comment survives; the `TagVar` embed then formats `var ${code}=_`, so the `=_` lands inside the comment. The doc that comes back is not the shape the handler unpicks, so it warns `Unable to format "TagVar"` and falls back to `printExact`, whose text still ends in the comment: `<a/x // c\n/>` prints as `<a/x // c/>`, where the `/>` is now part of the comment and the template no longer parses. This happens with the full Node prettier, not only without a JS parser. htmljs-parser already flags the hazard, since `isValidAttrValue` reports a value ending in a line comment as `valid` rather than `enclosed`, and `toValidExactAttrValue` in `src/utils/to-valid-doc.ts` acts on that for attr values by enclosing them in parens; a declarator cannot be parenthesized, so a tag var needs a line break after it instead. `var ${code}\n=_` keeps the embed parsing, but prettier moves the comment after the `=` (`var x = // c\n  _;`), where the handler's walk back to the `=` cuts it off, so the comment has to be carried past that and the open tag broken after the var; in concise mode nothing else can share the var's line.

Check: `pnpm run build && node -e 'import("prettier").then(async ({format}) => console.log(JSON.stringify(await format("<a/x // c\n/>", { parser: "marko", plugins: [await import("./dist/index.mjs")] }))))'` warns `Unable to format "TagVar"` and prints `"<a/x // c/>\n"`.
