import { ParserOptions } from "prettier";
import { Node } from "../constants";
import locToPos from "./loc-to-pos";
import babelGenerator from "@babel/generator";
const generate = (babelGenerator as any).default || babelGenerator;

export function getOriginalCodeForNode(opts: ParserOptions<Node>, node: Node) {
  const literal = literalToString(node);
  if (literal !== undefined) return literal;

  const loc = node.loc;
  if (!loc) {
    return generate(node as any, {
      filename: opts.filepath,
      compact: false,
      comments: true,
      sourceMaps: false,
    }).code;
  }

  return opts.originalText.slice(
    locToPos(loc.start, opts),
    locToPos(loc.end, opts)
  );
}

export function getOriginalCodeForList(
  opts: ParserOptions<Node>,
  sep: string,
  list: Node[]
) {
  return list.map((node) => getOriginalCodeForNode(opts, node)).join(sep);
}

function literalToString(node: Node) {
  switch (node.type) {
    case "StringLiteral":
      return `"${node.value.replace(/(["\\])/g, "\\$1")}"`;
    case "NumericLiteral":
      return node.value.toString();
    case "BooleanLiteral":
      return node.value ? "true" : "false";
    case "NullLiteral":
      return "null";
  }
}
