---
type: bug
impact: high
effort: low
site: src/index.ts › printHandlers[NodeType.Scriptlet]
---

# Print the `$` marker when a scriptlet falls back to an exact print

`printHandlers[NodeType.Scriptlet]` is `printExact`, and a scriptlet's range starts after its `$`, so the keyword is lost whenever the embed handler cannot run: `$ var foo = "bar";` comes back as ` var foo = "bar";`, which is text content rather than a statement, so the printed template no longer compiles. The embed handler for the same node prepends `"$ "`, so only the fallback path is wrong. That path is what every consumer without a JS parser gets, including the docs site, which formats `marko` fences through `prettier/standalone` with no parser plugin. Reading the marker back from the node's start, or prefixing `"$ "` the way the embed handler does, covers it; `Comment` nodes of the `js-line`/`js-block` fixtures look like the same shape and should be checked alongside.

Check: `pnpm run build && node -e 'import("prettier/standalone").then(async ({format}) => console.log(JSON.stringify(await format("$ var foo = 1;\n", { parser: "marko", plugins: [await import("./dist/index.mjs")] }))))'` prints `" var foo = 1;\n"`; expect `"$ var foo = 1;\n"`.
