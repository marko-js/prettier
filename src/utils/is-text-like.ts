import type { types as t } from "@marko/compiler";
import { Node } from "../constants";

export default function isTextLike(
  node: Node,
  parent: t.MarkoTag | t.Program
): boolean {
  if (isText(node)) {
    return true;
  } else if (node.type === "MarkoComment") {
    const body = parent.type === "Program" ? parent.body : parent.body.body;
    const i = body.indexOf(node);

    let j = i;
    while (j > 0) {
      const check = body[--j];
      if (isText(check)) return true;
      else if (check.type !== "MarkoComment") break;
    }

    j = i;
    while (j < body.length - 1) {
      const check = body[++j];
      if (isText(check)) return true;
      else if (check.type !== "MarkoComment") break;
    }
  }

  return false;
}

function isText(node: Node) {
  return node.type === "MarkoText" || node.type === "MarkoPlaceholder";
}
