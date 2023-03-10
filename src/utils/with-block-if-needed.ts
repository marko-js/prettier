import { types as t } from "@marko/compiler";
import { doc, Doc } from "prettier";

const { builders: b } = doc;

export default function withBlockIfNeeded(nodes: t.Statement[], docs: Doc[]) {
  if (nodes.length > 1) {
    return [
      b.indent([b.ifBreak(["{", b.line]), b.join(b.hardline, docs)]),
      b.ifBreak([b.line, "}"]),
    ];
  }

  return docs;
}
