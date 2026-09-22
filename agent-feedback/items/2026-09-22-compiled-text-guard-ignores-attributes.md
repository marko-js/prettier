---
type: dx
impact: med
effort: low
site: src/__tests__/index.test.ts › getCompiledText
---

# Extend the compiled-text guard past text content

`getCompiledText` accumulates only `MarkoText` and `MarkoPlaceholder` values, so the assertion that formatting preserved a template is blind to everything in an open tag: a dropped attribute, a lost `async` keyword, a renamed tag or a missing tag var all leave it green. It reads like a semantic guard and is the natural thing for a new case to lean on, which makes it a trap — the snapshots are what actually pin printed attributes, so a case added with only this assertion is unguarded. Walking `MarkoTag` names, attribute names and attribute value source alongside the text would make it cover what its name implies.

Check: delete `if (range.async) parent.start = range.start;` from `Builder.onAttrMethod`, which drops `async` from every shorthand method printed without a JS parser, then `pnpm test` — every `getCompiledText` comparison still passes and only the `attr-method-async` file snapshot fails.
