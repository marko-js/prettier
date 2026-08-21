---
type: cleanup
impact: low
effort: low
site: package.json › exports
---

# Expose `./package.json` from the exports map

The exports map lists only `.`, so `require("prettier-plugin-marko/package.json")` — the usual way to report which plugin build a format run used — throws `ERR_PACKAGE_PATH_NOT_EXPORTED`, and `src/index.ts` exports no `version` either. Every neighbour in the same one-liner resolves — `prettier` covers it with a `"./*"` wildcard and `@marko/runtime-tags` maps `"./package.json": "./package.json"` outright — so a tool that prints its toolchain versions has to special-case this package or read the file by hand. The same item is already filed against `htmljs-parser`, which has the identical one-line gap, so fixing both together keeps the chain consistent.

Check: `node -e "console.log(require('prettier-plugin-marko/package.json').version)"` from a project with the plugin installed prints `Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath './package.json' is not defined by "exports"`; expect it to print the version.
