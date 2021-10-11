import { doc, Doc, ParserOptions } from "prettier";

import { Node } from "../constants";
import locToPos from "./loc-to-pos";

const { builders: b } = doc;

export default function withLineIfNeeded(
  node: Node,
  opts: ParserOptions<Node>,
  doc: Doc
) {
  const { originalText } = opts;
  let pos = locToPos(node.loc!.start, opts);
  let count = 0;

  while (--pos >= 0) {
    let char = originalText[pos];

    if (char === "\n") {
      if (++count === 2) {
        while (--pos >= 0) {
          char = originalText[pos];
          // Only considers it a new line if there is non whitespace before it.
          if (char !== "\n" && char !== "\t" && char !== "\r" && char !== " ") {
            return [b.hardline, doc];
          }
        }
        return doc;
      }
    } else if (char !== "\t" && char !== "\r" && char !== " ") {
      break;
    }
  }

  return doc;
}
