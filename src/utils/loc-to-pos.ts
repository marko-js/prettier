import { ParserOptions } from "prettier";
import type { types as t } from "@marko/compiler";

export default function locToPos(
  loc: {
    line: number;
    column: number;
  },
  opts: ParserOptions<t.Node>,
) {
  const { markoLinePositions } = opts;
  return (
    markoLinePositions[loc.line - 1] + loc.column + (loc.line === 1 ? 0 : 1)
  );
}
