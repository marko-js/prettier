import type { types as t } from "@marko/compiler";
import { AstPath } from "prettier";

export default function getSibling(path: AstPath<t.Node>, direction: 1 | -1) {
  const node = path.getNode() as t.MarkoTagBody["body"][number];
  const body = (path.getParentNode() as t.Program | t.MarkoTagBody).body;
  return (body[body.indexOf(node) + direction] || null) as
    | t.MarkoTagBody["body"][number]
    | null;
}
