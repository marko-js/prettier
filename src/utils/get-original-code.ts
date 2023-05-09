import { ParserOptions } from "prettier";
import { Node } from "../constants";
import locToPos from "./loc-to-pos";
import babelGenerator from "@babel/generator";
const generate = (babelGenerator as any).default || babelGenerator;

export function getOriginalCodeForNode(opts: ParserOptions<Node>, node: Node) {
  const loc = node.loc;
  if (!loc) {
    return generate(node as any, {
      filename: opts.filepath,
      compact: false,
      comments: true,
      sourceMaps: false,
    }).code;
  }

  let start = loc.start;
  if (node.leadingComments?.length) {
    const commentStart = node.leadingComments[0].loc.start;
    if (
      commentStart.line < start.line ||
      (commentStart.line === start.line && commentStart.column < start.column)
    ) {
      start = commentStart;
    }
  }

  let end = loc.end;
  if (node.trailingComments?.length) {
    const commentEnd =
      node.trailingComments[node.trailingComments.length - 1].loc.end;
    if (
      commentEnd.line > end.line ||
      (commentEnd.line === end.line && commentEnd.column > end.column)
    ) {
      end = commentEnd;
    }
  }

  return opts.originalText.slice(locToPos(start, opts), locToPos(end, opts));
}

export function getOriginalCodeForList(
  opts: ParserOptions<Node>,
  sep: string,
  list: Node[]
) {
  return list.map((node) => getOriginalCodeForNode(opts, node)).join(sep);
}
