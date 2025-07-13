import type { types as t } from "@marko/compiler";
import { ParserOptions } from "prettier";
import locToPos from "./loc-to-pos";

export default function isTextLike(
  node: t.Node,
  parent: t.MarkoTag | t.Program,
  opts: ParserOptions<t.Node>,
): boolean {
  if (isText(node)) {
    return true;
  } else if (isInlineComment(node, opts)) {
    const body = parent.type === "Program" ? parent.body : parent.body.body;
    const i = body.indexOf(node);

    let j = i;
    while (j > 0) {
      const check = body[--j];
      if (isText(check)) return true;
      else if (!isInlineComment(check, opts)) break;
    }

    j = i;
    while (j < body.length - 1) {
      const check = body[++j];
      if (isText(check)) return true;
      else if (!isInlineComment(check, opts)) break;
    }
  }

  return false;
}

export function getCommentType(
  node: t.MarkoComment,
  opts: ParserOptions<t.Node>,
) {
  const start = node.loc?.start;
  switch (start != null && opts.originalText[locToPos(start, opts) + 1]) {
    case "/":
      return "/";
    case "*":
      return "*";
    default:
      return "-";
  }
}

function isInlineComment(
  node: t.Node,
  opts: ParserOptions<t.Node>,
): node is t.MarkoComment {
  return node.type === "MarkoComment" && getCommentType(node, opts) !== "/";
}

function isText(node: t.Node) {
  return node.type === "MarkoText" || node.type === "MarkoPlaceholder";
}
