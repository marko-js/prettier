import { doc, Doc, ParserOptions } from "prettier";
import { Node, enclosedNodeTypeReg } from "../constants";
import outerCodeMatches from "./outer-code-matches";

const { builders: b } = doc;

export default function withParensIfNeeded(
  node: Node,
  opts: ParserOptions,
  valDoc: Doc
) {
  if (
    !enclosedNodeTypeReg.test(node.type) &&
    outerCodeMatches(
      doc.printer.printDocToString(valDoc, {
        ...opts,
        printWidth: 0,
      }).formatted,
      /\s|>/y,
      opts.markoAttrParen
    )
  ) {
    return ["(", b.indent([b.softline, valDoc]), b.softline, ")"];
  }

  return valDoc;
}
