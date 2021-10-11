import { ParserOptions } from "prettier";
import { Node } from "../constants";
import locToPos from "./loc-to-pos";

export default function getOriginalCode(
  opts: ParserOptions<Node>,
  start: Node,
  end: Node = start
) {
  return opts.originalText.slice(
    locToPos(start.loc!.start, opts),
    locToPos(end.loc!.end, opts)
  );
}
