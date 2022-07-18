import { ParserOptions } from "prettier";
import { Node } from "../constants";
import locToPos from "./loc-to-pos";
import generate from "@babel/generator";

export default function getOriginalCode(
  opts: ParserOptions<Node>,
  start: Node,
  end: Node = start
) {
  const startLoc = start.loc;
  const endLoc = end.loc;

  if ((start === end && !startLoc) || !endLoc) {
    // Work around for manually generated ast like class shorthand.
    return generate(start as any, {
      filename: opts.filepath,
      compact: false,
      comments: true,
      sourceMaps: false,
    }).code;
  }

  return opts.originalText.slice(
    locToPos(startLoc!.start, opts),
    locToPos(endLoc!.end, opts)
  );
}
