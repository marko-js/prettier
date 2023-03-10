import { types as t } from "@marko/compiler";
import { doc, Doc, ParserOptions } from "prettier";
import { enclosedNodeTypeReg } from "../constants";
import outerCodeMatches from "./outer-code-matches";

const { builders: b } = doc;

export default function withBlockIfNeeded(
  nodes: t.Statement[],
  opts: ParserOptions,
  /* must use a factory function because `printDocToString` has side effects */
  getDocs: () => Doc[]
) {
  if (
    nodes.length > 1 ||
    (!enclosedNodeTypeReg.test(nodes[0].type) &&
      outerCodeMatches(
        doc.printer.printDocToString(getDocs(), {
          ...opts,
          printWidth: 0,
        }).formatted,
        /[\n\r]/y
      ))
  ) {
    return [
      b.indent([b.ifBreak(["{", b.line]), b.join(b.hardline, getDocs())]),
      b.ifBreak([b.line, "}"]),
    ];
  }

  return getDocs();
}
