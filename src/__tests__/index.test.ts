import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

import * as compiler from "@marko/compiler";
import snapshot from "mocha-snap";
import { format, type Options } from "prettier";

import * as plugin from "..";

const cwd = process.cwd();
const fixtures = path.relative(cwd, path.join(__dirname, "fixtures"));
const { traverseFast } = compiler.types;
const skip = (traverseFast as any).skip as symbol;
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

    before(() => {
      source = fs.readFileSync(filepath, "utf-8");
      text = getCompiledText(filepath, source);
    });

    it("auto", formatWith({}));
    it("html", formatWith({ markoSyntax: "html" }));
    it("concise", formatWith({ markoSyntax: "concise" }));

    function formatWith(opts: Partial<Options>) {
      return async () => {
        let err: unknown;
        await snapshot(
          async () => {
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
            try {
              assert.equal(
                reformatted,
                formatted,
                `${filepath}: Expected reformatting to be idempotent.`,
              );

              assert.equal(
                getCompiledText(filepath, formatted),
                text,
                `${filepath}: Formatting should not alter the compiled text.`,
              );
            } catch (e) {
              err = e;
            }

            return reformatted;
          },
          { dir, ext: ".marko" },
        );

        if (err) throw err;
      };
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
