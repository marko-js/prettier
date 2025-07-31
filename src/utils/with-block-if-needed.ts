import type { types as t } from "@marko/compiler";
import { doc as d, type Doc } from "prettier";
import { enclosedNodeTypeReg } from "../constants";
import outerCodeMatches from "./outer-code-matches";
import printDoc from "./print-doc";

const { builders: b } = d;

export default function withBlockIfNeeded(node: t.Statement, doc: Doc) {
  if (
    (!enclosedNodeTypeReg.test(node.type) &&
      outerCodeMatches(printDoc(doc).trim(), /[\n\r]/y)) ||
    node.leadingComments ||
    node.trailingComments
  ) {
    return b.group([
      b.indent([b.ifBreak(["{", b.line]), doc]),
      b.ifBreak([b.line, "}"]),
    ]);
  }

  return doc;
}
