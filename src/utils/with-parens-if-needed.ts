import { doc as d, type Doc } from "prettier";
import type { types as t } from "@marko/compiler";
import { enclosedNodeTypeReg } from "../constants";
import outerCodeMatches from "./outer-code-matches";
import printDoc from "./print-doc";

const { builders: b } = d;

export function withParensIfNeeded(node: t.Node, doc: Doc, enclosed?: boolean) {
  if (
    (node as any).leadingComments?.length ||
    (node as any).trailingComments?.length ||
    (!enclosedNodeTypeReg.test(node.type) &&
      outerCodeMatches(printDoc(doc).trim(), /\s|>/y, enclosed))
  ) {
    return b.group(["(", b.indent([b.softline, doc]), b.softline, ")"]);
  }

  if (node.type === "LogicalExpression") {
    return withParensIfBreak(node, doc);
  }

  return doc;
}

export function withParensIfBreak(node: t.Node, doc: Doc) {
  if (
    (node as any).leadingComments?.length ||
    (node as any).trailingComments?.length ||
    (!enclosedNodeTypeReg.test(node.type) &&
      outerCodeMatches(printDoc(doc).trim(), /\n/y, true))
  ) {
    return b.group([
      b.ifBreak("(", ""),
      b.indent([b.softline, doc]),
      b.softline,
      b.ifBreak(")", ""),
    ]);
  }

  return doc;
}
