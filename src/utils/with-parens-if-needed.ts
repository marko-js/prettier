import { doc, Doc, ParserOptions } from "prettier";
import { Node, enclosedNodeTypeReg } from "../constants";
import outerCodeMatches from "./outer-code-matches";

const { builders: b } = doc;

export default function withParensIfNeeded(
  node: Node,
  opts: ParserOptions,
  valDoc: Doc
) {
  if (enclosedNodeTypeReg.test(node.type)) return valDoc;
  const { formatted } = doc.printer.printDocToString(valDoc, {
    ...opts,
    printWidth: 0,
  });
  if (
    opts.markoAttrParen
      ? outerCodeMatches(formatted, /\s|>/y, true)
      : outerCodeMatches(formatted, />/y, false)
  ) {
    return ["(", b.indent([b.softline, valDoc]), b.softline, ")"];
  } else if (outerCodeMatches(formatted, /\n/y, false)) {
    return [
      b.ifBreak("("),
      b.indent([b.softline, valDoc]),
      b.ifBreak([b.softline, ")"]),
    ];
  }

  return valDoc;
}
