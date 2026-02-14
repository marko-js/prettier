import { isValidStatement, Validity } from "htmljs-parser";
import { type Doc, doc as d } from "prettier";

import printDoc from "./print-doc";

const { builders: b } = d;

export default function withBlockIfNeeded(doc: Doc) {
  const code = printDoc(doc).trim();
  if (isValidStatement(code) !== Validity.invalid) {
    return doc;
  }

  return b.group([
    b.ifBreak("{"),
    b.indent([b.softline, doc]),
    b.softline,
    b.ifBreak("}"),
  ]);
}
