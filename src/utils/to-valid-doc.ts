import {
  isValidAttrValue,
  isValidScriptlet,
  isValidStatement,
  Validity,
} from "htmljs-parser";
import { type Doc, doc as d } from "prettier";

import printDoc from "./print-doc";

const { builders: b } = d;

export function toValidAttrValue(doc: Doc, concise: boolean) {
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
      return b.group(["(", b.indent([b.softline, doc]), b.softline, ")"]);
  }
}

export function toValidScriptlet(doc: Doc) {
  return toValidBlock(doc, isValidScriptlet);
}

export function toValidStatement(doc: Doc) {
  return toValidBlock(doc, isValidStatement);
}

function toValidBlock(doc: Doc, check: (code: string) => Validity) {
  const code = printDoc(doc).trim();
  if (check(code) === Validity.enclosed) {
    return doc;
  }

  return b.group([
    b.ifBreak("{"),
    b.indent([b.softline, doc]),
    b.softline,
    b.ifBreak("}"),
  ]);
}
