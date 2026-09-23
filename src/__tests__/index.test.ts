import fs from "node:fs";
import path from "node:path";

import * as compiler from "@marko/compiler";
import { format, type Options } from "prettier";
import { format as formatStandalone } from "prettier/standalone";

import * as plugin from "..";

const fixtures = path.join(import.meta.dirname, "fixtures");
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

// These use Marko 5's `class {}` block, which the Marko 6 translator rejects.
const marko5Fixtures = new Set([
  "class",
  "component",
  "expression-comments",
  "something-wrong",
]);

for (const entry of fs.readdirSync(fixtures)) {
  if (/\.skip\./g.test(entry)) continue;
  const fixtureName = entry.replace(/\..*$/, "");
  const translator = marko5Fixtures.has(fixtureName)
    ? "marko-5/translator"
    : undefined;

  describe(fixtureName, () => {
    const dir = path.join(fixtures, entry);
    const filepath = path.join(dir, "template.marko");
    let source: string;
    let shape: Shape;

    beforeAll(() => {
      source = fs.readFileSync(filepath, "utf-8");
      shape = getCompiledShape(filepath, source, translator);
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
        const { text, code } = getCompiledShape(
          filepath,
          formatted,
          translator,
        );
        expect(text).toBe(shape.text);
        if (shape.code !== undefined) expect(code).toBe(shape.code);
      });

      // `prettier/standalone` with only this plugin cannot embed JS, so this
      // covers the printer's fallback of printing code from source.
      it(`${name} without a JS parser`, async () => {
        const fullOpts = {
          filepath,
          parser: "marko",
          plugins: [plugin],
          ...opts,
        };
        const formatted = await formatStandalone(source, fullOpts);
        expect(await formatStandalone(formatted, fullOpts)).toBe(formatted);
        const { text, code } = getCompiledShape(
          filepath,
          formatted,
          translator,
        );
        expect(text).toBe(shape.text);
        if (shape.code !== undefined) expect(code).toBe(shape.code);
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

interface Shape {
  /** Rendered text, which formatting may split, join or move across tags. */
  text: string;
  /** Tags, attrs and JS as their AST, unless the source failed to parse. */
  code: string | undefined;
}

function getCompiledShape(
  filepath: string,
  source: string,
  translator?: string,
): Shape {
  const { ast } = compiler.compileSync(source, filepath, {
    ...compileOpts,
    translator,
  });
  const shape = { text: "", code: "", parsed: true };
  addShape(shape, ast.program.body);
  return {
    text: shape.text.replace(/\s+/g, " "),
    // Prettier may repair or drop code that did not parse.
    code: shape.parsed ? shape.code : undefined,
  };
}

function addShape(
  shape: { text: string; code: string; parsed: boolean },
  nodes: compiler.types.Node[],
) {
  const toJSON = (value: unknown) =>
    JSON.stringify(value, (key, val) => {
      if (unshapedKeys.has(key)) return undefined;
      if (val?.type === "MarkoParseError") shape.parsed = false;
      // Formatting drops redundant type parens, stray `;` and empty `()`.
      while (val?.type === "TSParenthesizedType") val = val.typeAnnotation;
      if (Array.isArray(val)) {
        val = val.filter((node) => node?.type !== "EmptyStatement");
        if (!val.length) return undefined;
      }
      return val ?? undefined;
    });

  for (const node of nodes) {
    switch (node.type) {
      case "MarkoText":
        shape.text += node.value.replace(/\n[ \t]+$/gm, "\n");
        break;
      case "MarkoPlaceholder":
        if (node.value.type === "StringLiteral") {
          shape.text += node.value.value;
        } else {
          shape.code += `\${${toJSON(node.value)}}`;
        }
        break;
      case "MarkoComment":
        break; // not rendered
      case "MarkoDocumentType":
      case "MarkoDeclaration": {
        // The printer collapses their whitespace.
        const value = node.value.replace(/\s+/g, " ").trim();
        shape.code += toJSON({ ...node, value });
        break;
      }
      case "MarkoTag": {
        // Embedded code, eg css parsed as attrs, is formatted by other plugins.
        if (isEmbeddedCodeTag(node)) {
          shape.code += `<${toJSON(node.name)}/>`;
          break;
        }

        const { body, ...tag } = node;
        const { params } = body;
        // Type params are dropped along with the empty params they would type.
        const typeParameters = params.length ? body.typeParameters : undefined;
        shape.code += `<${toJSON({ ...tag, params, typeParameters })}>`;
        addShape(shape, body.body);
        shape.code += "</>";
        break;
      }
      default:
        shape.code += toJSON(node);
        break;
    }
  }
}

// Positions, raw source and comments all change with formatting.
const unshapedKeys = new Set([
  "loc",
  "start",
  "end",
  "extra",
  "rawValue",
  "leadingComments",
  "innerComments",
  "trailingComments",
]);

function isEmbeddedCodeTag(node: compiler.types.MarkoTag) {
  if (node.name.type === "StringLiteral") {
    switch (node.name.value) {
      case "script":
      case "html-script":
      case "style":
      case "html-style":
        return true;
    }
  }

  return false;
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
