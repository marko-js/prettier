import { doc, Doc, ParserOptions } from "prettier";
import { Node, enclosedNodeTypeReg } from "../constants";
import outerCodeMatches from "./outer-code-matches";

const { builders: b } = doc;

export default function withParensIfNeeded(
  node: Node,
  opts: ParserOptions,
  /* must use a factory function because `printDocToString` has side effects */
  getValDoc: () => Doc
) {
  if (
    !enclosedNodeTypeReg.test(node.type) &&
    outerCodeMatches(
      doc.printer.printDocToString(getValDoc(), {
        ...opts,
        printWidth: 0,
      }).formatted,
      /\s|>/y,
      opts.markoAttrParen
    )
  ) {
    return ["(", b.indent([b.softline, getValDoc()]), b.softline, ")"];
  }

  return getValDoc();
}
