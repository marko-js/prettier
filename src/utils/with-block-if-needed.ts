import { types as t } from "@marko/compiler";
import { doc, Doc, format, ParserOptions } from "prettier";
import { enclosedNodeTypeReg } from "../constants";
import outerCodeMatches from "./outer-code-matches";
import { getOriginalCodeForNode } from "./get-original-code";

const { builders: b } = doc;

export default function withBlockIfNeeded(
  node: t.Statement,
  opts: ParserOptions,
  docs: Doc
) {
  if (
    !enclosedNodeTypeReg.test(node.type) &&
    outerCodeMatches(
      format(getOriginalCodeForNode(opts, node), {
        ...opts,
        printWidth: 0,
        parser: opts.markoScriptParser,
      }).trim(),
      /[\n\r]/y
    )
  ) {
    return b.group([
      b.indent([b.ifBreak(["{", b.line]), docs]),
      b.ifBreak([b.line, "}"]),
    ]);
  }

  return docs;
}
