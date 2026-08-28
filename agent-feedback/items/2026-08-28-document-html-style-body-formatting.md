---
type: unclear
impact: low
effort: low
site: README.md › # Options
---

# Say in the README that `<html-style>`/`<html-script>` bodies are formatted and that `embeddedLanguageFormatting: "off"` is the only (global) way to keep them as written

`getTagParser` in `src/utils/get-parser-name.ts` returns `"css"` for `html-style` with no `type=` test, and `getScriptTagParser` returns `babel-ts`/`json` for `html-script` unless its `type=` falls outside module/text/javascript/application/javascript/importmap/speculationrules/application/json, so both bodies are reprinted by prettier's embedded printers. Marko writes those bodies out verbatim (`packages/runtime-tags/src/translator/core/html-style.ts` parses them with `text: true, preserveWhitespace: true`), so a `--write` changes the rendered bytes of every page that uses the tags, and a project holding a "formatting must not change the rendered output" gate has to read the plugin's source to learn that this is intended. It is intended: `src/__tests__/fixtures/html-style-element` and `src/__tests__/fixtures/script-with-type` pin it, and `getCompiledText` in `src/__tests__/index.test.ts` skips `script`, `html-script`, `style` and `html-style` before asserting the compiled text is unchanged. README.md's only option section is `markoSyntax` and never mentions any of it. Add a paragraph under `# Options` naming the tag bodies that get reformatted, saying that Prettier's `embeddedLanguageFormatting: "off"` is the only lever and that it is global (prettier 3.9.6 returns from `printEmbeddedLanguages` before running `embed` whenever the option is not `"auto"`, so it also stops formatting `<style>`, `<script>`, `static`, attribute values and `${}` placeholders), and that `<html-style>` ignores `type=` entirely while `<html-script>` with an unrecognised `type=` is left as written.

Check: `grep -n -i 'embedded\|html-style\|html-script\|preserve\|verbatim' README.md` exits 1 with no output. Then `pnpm run build && printf '<html-style type="text/css">\n  body { margin: 0; padding: 0; }\n</html-style>\n<html-style>#incidents-placeholder { display: none; }</html-style>\n' > /tmp/hs.marko && pnpm exec prettier --no-config --plugin ./dist/index.mjs --parser marko /tmp/hs.marko` expands both bodies to one declaration per line, while adding `--embedded-language-formatting=off` returns the input byte-identical.
