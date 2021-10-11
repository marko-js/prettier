import { ParserOptions } from "prettier";
import { Node } from "../constants";

export default function locToPos(
  loc: {
    line: number;
    column: number;
  },
  opts: ParserOptions<Node>
) {
  const { markoLinePositions } = opts;
  return (
    markoLinePositions[loc.line - 1] + loc.column + (loc.line === 1 ? 0 : 1)
  );
}
