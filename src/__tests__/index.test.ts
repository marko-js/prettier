import fs from "fs";
import path from "path";
import snapshot from "mocha-snap";
import { format, Options } from "prettier";
import * as plugin from "..";

const cwd = process.cwd();
const fixturesDir = path.join(__dirname, "fixtures");

for (const entry of fs.readdirSync(fixturesDir)) {
  if (/\.skip\./g.test(entry)) continue;

  const name = entry.replace(/\..*$/, "");
  it(name, async () => {
    const filepath = path.relative(cwd, path.join(fixturesDir, entry));
    const source = await fs.promises.readFile(filepath, "utf-8");
    const formatAndCheck = async (opts?: Partial<Options>) => {
      const fullOpts = {
        filepath,
        parser: "marko",
        plugins: [plugin],
        ...opts,
      };

      const formatted = await format(source, fullOpts);
      // TODO: need to fix idempotency.
      // const reformatted = format(formatted, fullOpts);
      // assert.equal(reformatted, formatted);
      return formatted;
    };

    await Promise.all([
      snapshot(() => formatAndCheck({ markoAttrParen: false }), {
        file: "auto.marko",
      }),
      snapshot(
        () =>
          formatAndCheck({
            markoSyntax: "html",
            markoAttrParen: false,
          }),
        { file: "html.marko" },
      ),
      snapshot(
        () =>
          formatAndCheck({
            markoSyntax: "concise",
            markoAttrParen: false,
          }),
        { file: "concise.marko" },
      ),
      snapshot(
        () =>
          formatAndCheck({
            markoAttrParen: true,
          }),
        { file: "with-parens.marko" },
      ),
    ]);
  });
}
