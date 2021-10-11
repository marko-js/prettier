import { types as t } from "@marko/compiler";
import { Node } from "../constants";

export default function isTextLike(
  node: Node,
  parent: t.MarkoTag | t.Program
): boolean {
  switch (node.type) {
    case "MarkoText":
    case "MarkoPlaceholder":
      return true;
    case "MarkoComment": {
      const body = parent.type === "Program" ? parent.body : parent.body.body;
      const i = body.indexOf(node);
      return (
        i > 0 &&
        i < body.length - 1 &&
        (isTextLike(body[i - 1], parent) || isTextLike(body[i + 1], parent))
      );
    }
    default:
      return false;
  }
}
