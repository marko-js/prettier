import { AstPath, ParserOptions } from "prettier";
import type { types as t } from "@marko/compiler";
import locToPos from "./loc-to-pos";
import { generator } from "@marko/compiler/internal/babel";

export function getOriginalCodeForNode(
  opts: ParserOptions<t.Node>,
  node: t.Node,
  path?: AstPath<t.Node>,
): string {
  const hasLeadingComments =
    node.leadingComments?.length &&
    !(path && path.getParentNode()?.type === "MarkoScriptlet" && !path.isFirst);
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
    return generator(node, {
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
