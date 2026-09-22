---
type: dx
impact: low
effort: low
site: package.json › devDependencies.typescript
---

# Revisit the TypeScript 7 bump once typescript-eslint supports it

`typescript` is held at `^6.0.3` while 7.0.2 is published, because `typescript-eslint@8.70.1` refuses to load against it, so `pnpm run @ci:lint` dies before linting a single file. `tsc -b` and the test suite pass on 7, so the hold is the lint step alone. A note here saves the next agent the bisect: when typescript-eslint announces TS 7 support, bump both together.

Check: `pnpm add -D typescript@7 && pnpm run @ci:lint` exits 2 with `Error: typescript-eslint does not support TS 7.0.`
