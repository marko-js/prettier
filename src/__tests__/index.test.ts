import fs from "node:fs";
import path from "node:path";

import * as compiler from "@marko/compiler";
import { format, type Options } from "prettier";
import { format as formatWithoutParsers } from "prettier/standalone";

import * as plugin from "..";

const fixtures = path.join(import.meta.dirname, "fixtures");
const { traverseFast } = compiler.types;
// `traverseFast.skip` is a `unique symbol`, but the `@marko/compiler` re-export
// widens it to `symbol`; recover the precise type from the visitor signature.
const skip = traverseFast.skip as Exclude<
  ReturnType<Parameters<typeof traverseFast>[1]>,
  void
>;
const compileOpts: compiler.Config = {
  output: "source",
  ast: true,
  code: false,
  sourceMaps: false,
  stripTypes: false,
  errorRecovery: true,
  babelConfig: {
    comments: false,
    babelrc: false,
    configFile: false,
    browserslistConfigFile: false,
  },
};

// `class {}` component blocks are Marko 5, which the installed Marko 6
// translator rejects, so these cannot be compiled to compare their text.
const marko5Fixtures = new Set([
  "class",
  "component",
  "expression-comments",
  "something-wrong",
]);

for (const entry of fs.readdirSync(fixtures)) {
  if (/\.skip\./g.test(entry)) continue;
  const fixtureName = entry.replace(/\..*$/, "");

  describe(fixtureName, () => {
    const dir = path.join(fixtures, entry);
    const filepath = path.join(dir, "template.marko");
    let source: string;
    let text: string | undefined;

    beforeAll(() => {
      source = fs.readFileSync(filepath, "utf-8");
      text = marko5Fixtures.has(fixtureName)
        ? undefined
        : getCompiledText(filepath, source);
    });

    testFormat("auto", {});
    testFormat("html", { markoSyntax: "html" });
    testFormat("concise", { markoSyntax: "concise" });

    function testFormat(name: string, opts: Partial<Options>) {
      it(name, async () => {
        const fullOpts = {
          filepath,
          parser: "marko",
          plugins: [plugin],
          ...opts,
        };

        const formatted = await format(source, fullOpts);
        const reformatted = await format(formatted, {
          ...fullOpts,
          filepath: undefined,
        });

        await expect(reformatted).toMatchFileSnapshot(
          path.join(dir, "__snapshots__", `${name}.expected.marko`),
        );

        expect(reformatted).toBe(formatted);
        if (text !== undefined) {
          expect(getCompiledText(filepath, formatted)).toBe(text);
        }
      });
    }
  });
}

function getCompiledText(filepath: string, source: string) {
  let text = "";
  traverseFast(
    compiler.compileSync(source, filepath, compileOpts).ast,
    (node) => {
      switch (node.type) {
        case "MarkoText":
          text += node.value.replace(/\n[ \t]+$/gm, "\n");
          break;
        case "MarkoPlaceholder":
          if (node.value.type === "StringLiteral") {
            text += node.value.value;
          }
          break;
        case "MarkoTag":
          if (node.name.type === "StringLiteral") {
            switch (node.name.value) {
              case "script":
              case "html-script":
              case "style":
              case "html-style":
                return skip;
            }
          }
          break;
      }
    },
  );

  return text.replace(/\s+/g, " ");
}

describe("without an embedded js parser", () => {
  for (const fixture of ["attr-method-async", "attr-default-method"]) {
    it(fixture, async () => {
      const dir = path.join(fixtures, fixture);
      const filepath = path.join(dir, "template.marko");
      const source = fs.readFileSync(filepath, "utf-8");
      const formatted = await formatStandalone(source, filepath);

      await expect(formatted).toMatchFileSnapshot(
        path.join(dir, "__snapshots__", "no-js-parser.expected.marko"),
      );
      expect(await formatStandalone(formatted, filepath)).toBe(formatted);
    });
  }

  function formatStandalone(source: string, filepath: string) {
    return formatWithoutParsers(source, {
      filepath,
      parser: "marko",
      plugins: [plugin],
    });
  }
});

describe("singleQuote mode", () => {
  it("prints with single quotes", async () => {
    const filepath = path.join(fixtures, "whitespace/template.marko");
    const source = fs.readFileSync(filepath, "utf-8");
    const formatted = (
      await format(source, {
        filepath,
        parser: "marko",
        plugins: [plugin],
        singleQuote: false,
      })
    ).replace(/"/g, "'");
    const reformatted = await format(formatted, {
      filepath,
      parser: "marko",
      plugins: [plugin],
      singleQuote: true,
    });
    expect(reformatted).toBe(formatted);
  });
});
