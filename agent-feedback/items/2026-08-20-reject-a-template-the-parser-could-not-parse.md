---
type: bug
impact: high
effort: med
site: src/parser.ts › Builder
---

# Reject a template htmljs-parser could not parse instead of printing the truncated tree

`Builder` implements no `onError`, and htmljs-parser's `Parser.emitError` ends the scan by moving `pos` past `maxPos`, so the first syntax error silently stops the parse and the printer emits the partial program as if it were the whole document. `--write` therefore repairs broken templates into different, valid ones and exits 0: `<div>\n  <span>hello\n</div>` comes back as `<div><span>hello</span></div>`, a stray `</span>` line is deleted, and (with htmljs-parser 5.15, which the `^5.14.0` dependency range allows) an html comment in an attribute list truncates the file — a twelve-line component whose third line is `<div class="probe" <!-- counter --> id="main">` comes back as `<let/count=0>` plus `<div class="probe"/>`, losing the button, its handler, the body and the `<style>` block. The rewrite is idempotent and `--check` reports only `Code style issues found`, so on a file that does not compile the only failing check tells the developer to run the command that destroys the evidence. Collecting the parser's errors in `Builder` and throwing a prettier `SyntaxError` with the reported range costs nothing at the fixture level: every `src/__tests__/fixtures/*/template.marko` parses without an error today, including the void tags in `doctype` and the statements in `export-multiline`.

Check: `printf '<div>\n  <span>hello\n</div>\n' > /tmp/x.marko && pnpm run build && pnpm exec prettier --plugin ./dist/index.mjs --parser marko /tmp/x.marko` prints `<div><span>hello</span></div>` and exits 0, while the same input handed to `createParser` with an `onError` reports `The closing "div" tag does not match the corresponding opening "span" tag`; expect prettier to surface that error and print nothing.
