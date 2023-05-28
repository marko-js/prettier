import { types as t } from "@marko/compiler";
import { doc, Doc, format, ParserOptions } from "prettier";
import { enclosedNodeTypeReg } from "../constants";
import outerCodeMatches from "./outer-code-matches";
import { getOriginalCodeForNode } from "./get-original-code";

const { builders: b } = doc;

export default function withBlockIfNeeded(
  nodes: t.Statement[],
  opts: ParserOptions,
  docs: Doc[]
) {
  let count = 0;
  let statement!: t.Statement;
  for (const node of nodes) {
    if (node.type === "EmptyStatement") continue;
    if (++count > 1) break;
    statement = node;
  }

  if (
    count > 1 ||
    (!enclosedNodeTypeReg.test(statement.type) &&
      outerCodeMatches(
        format(getOriginalCodeForNode(opts, statement), {
          ...opts,
          printWidth: 0,
          parser: opts.markoScriptParser,
        }).trim(),
        /[\n\r]/y
      ))
  ) {
    return [
      b.indent([b.ifBreak(["{", b.line]), b.join(b.hardline, docs)]),
      b.ifBreak([b.line, "}"]),
    ];
  }

  return docs;
}
