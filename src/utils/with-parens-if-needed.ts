import { isValidAttrValue, Validity } from "htmljs-parser";
import { type Doc, doc as d } from "prettier";

import printDoc from "./print-doc";

const { builders: b } = d;

export default function withParensIfNeeded(doc: Doc, concise: boolean) {
  const code = printDoc(doc).trim();
  switch (isValidAttrValue(code, concise)) {
    case Validity.enclosed:
      return doc;
    case Validity.valid:
      return b.group([
        b.ifBreak("("),
        b.indent([b.softline, doc]),
        b.softline,
        b.ifBreak(")"),
      ]);
    default:
      return b.group([b.indent(["(", b.softline, doc]), b.softline, ")"]);
  }
}
