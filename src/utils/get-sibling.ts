import type { types as t } from "@marko/compiler";
import { AstPath } from "prettier";
import { Node } from "../constants";

export default function getSibling(path: AstPath<Node>, direction: 1 | -1) {
  const node = path.getValue() as t.MarkoTagBody["body"][number];
  const body = (path.getParentNode() as t.Program | t.MarkoTagBody).body;
  return (body[body.indexOf(node) + direction] || null) as
    | t.MarkoTagBody["body"][number]
    | null;
}
