import { doc, Doc, format, ParserOptions } from "prettier";
import { Node, enclosedNodeTypeReg } from "../constants";
import outerCodeMatches from "./outer-code-matches";
import { getOriginalCodeForNode } from "./get-original-code";

const { builders: b } = doc;

export default function withParensIfNeeded(
  node: Node,
  opts: ParserOptions,
  doc: Doc
) {
  if (
    (node as any).leadingComments?.length ||
    (node as any).trailingComments?.length ||
    (!enclosedNodeTypeReg.test(node.type) &&
      outerCodeMatches(
        format(`_(${getOriginalCodeForNode(opts, node)})`, {
          ...opts,
          printWidth: 0,
          parser: opts.markoScriptParser,
        })
          .replace(/^_\(([\s\S]*)\);?$/m, "$1")
          .trim(),
        /\s|>/y,
        opts.markoAttrParen
      ))
  ) {
    return ["(", b.indent([b.softline, doc]), b.softline, ")"];
  }

  return doc;
}
