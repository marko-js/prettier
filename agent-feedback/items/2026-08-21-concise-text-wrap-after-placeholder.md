---
type: bug
impact: med
effort: med
site: src/index.ts › printBody
---

# Do not break a concise `--` text line directly after a placeholder

`printBody` turns every space in a `Text` child into a `b.line`, and `wrapConciseText` lets the fill break at any of them, but in a concise `--` body the continuation newline is not always worth a space. htmljs-parser reports `div --\n  a\n  b` as `Text "a\n"` + `Text "b"`, which the compiler collapses to `a b`, while `div --\n  a ${1}\n  b` becomes `Text "a "` + `Placeholder` + `Text "\n"` + `Text "b"` and the stranded whitespace-only text node is dropped, giving `a 1b`. Choosing that break therefore changes the page: at the default `printWidth` of 80, `div\n  -- <21 short words> ${1} b` compiles to `... 1 b` and its formatted form compiles to `... 1b`, and the next pass collapses the file to `${1}b`, so the printer is not idempotent either. Either keep the space visible at that break (the `${" "}` machinery already exists) or refuse to break a concise fill immediately after a `Placeholder`; the same wrap is safe in HTML mode, where `<div>a ${1}\n  b</div>` still compiles to `a 1 b`.

Check: format `div\n  -- w0 w1 w2 w3 w4 w5 w6 w7 w8 w9 w10 w11 w12 w13 w14 w15 w16 w17 w18 w19 w20 ${1} b` and compile before and after with `@marko/compiler`; today the emitted markup goes from `w20 1 b` to `w20 1b` and a second format pass rewrites `${1}\n  b` to `${1}b`, and both should be no-ops.
