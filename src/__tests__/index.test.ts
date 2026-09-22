import fs from "node:fs";
import path from "node:path";

import * as compiler from "@marko/compiler";
import { format, type Options } from "prettier";

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

for (const entry of fs.readdirSync(fixtures)) {
  if (/\.skip\./g.test(entry)) continue;
  const fixtureName = entry.replace(/\..*$/, "");

  describe(fixtureName, () => {
    const dir = path.join(fixtures, entry);
    const filepath = path.join(dir, "template.marko");
    let source: string;
    let text: string;

    beforeAll(() => {
      source = fs.readFileSync(filepath, "utf-8");
      text = getCompiledText(filepath, source);
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
        expect(getCompiledText(filepath, formatted)).toBe(text);
      });
    }
  });
}

describe("unparseable template", () => {
  // The parser stops at its first error, so the tree it built is only the
  // file up to there; formatting has to fail rather than print that.
  const cases: [name: string, source: string, message: string, line: number][] =
    [
      [
        "mismatched closing tag",
        "<div>\n  <span>hello\n</div>\n",
        'The closing "div" tag does not match the corresponding opening "span" tag',
        3,
      ],
      [
        "unparenthesized > in an attribute value",
        '<button>\n  <icon agent=items.length > 1 ? "a" : "b"/>\n</button>\n<ul>\n  <li>kept</li>\n</ul>\n',
        'The closing "button" tag does not match the corresponding opening "icon" tag',
        3,
      ],
      [
        "unexpected closing tag",
        "<div/>\n</span>\n",
        'The closing "span" tag was not expected',
        2,
      ],
    ];

  for (const [name, source, message, line] of cases) {
    it(`rejects ${name}`, async () => {
      await expect(
        format(source, { parser: "marko", plugins: [plugin] }),
      ).rejects.toMatchObject({
        name: "SyntaxError",
        message: expect.stringContaining(message),
        loc: { start: { line, column: 1 } },
      });
    });
  }
});

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
