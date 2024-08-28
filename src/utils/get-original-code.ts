import { ParserOptions } from "prettier";
import type { types as t } from "@marko/compiler";
import locToPos from "./loc-to-pos";
import babelGenerator from "@babel/generator";
const generate = (babelGenerator as any).default || babelGenerator;

export function getOriginalCodeForNode(
  opts: ParserOptions<t.Node>,
  node: t.Node,
) {
  const hasLeadingComments = node.leadingComments?.length;
  const hasTrailingComments = node.trailingComments?.length;

  if (!hasLeadingComments && !hasTrailingComments) {
    switch (node.type) {
      case "StringLiteral":
        return JSON.stringify(node.value);
      case "BooleanLiteral":
      case "NumericLiteral":
        return "" + node.value;
      case "NullLiteral":
        return "null";
    }
  }

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
  if (hasLeadingComments) {
    const commentStart = node.leadingComments![0].loc.start;
    if (
      commentStart.line < start.line ||
      (commentStart.line === start.line && commentStart.column < start.column)
    ) {
      start = commentStart;
    }
  }

  let end = loc.end;
  if (hasTrailingComments) {
    const commentEnd =
      node.trailingComments![node.trailingComments!.length - 1].loc.end;
    if (
      commentEnd.line > end.line ||
      (commentEnd.line === end.line && commentEnd.column > end.column)
    ) {
      end = commentEnd;
    }
  }

  return opts.originalText.slice(locToPos(start, opts), locToPos(end, opts));
}
