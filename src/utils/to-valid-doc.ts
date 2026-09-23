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

// A value printed from source keeps its text, so unless htmljs-parser reports
// it safe to inline, eg it ends in a line comment, it is enclosed in parens,
// and if that is still not safe, across lines. Those newlines are text, like
// the rest of the source, so the next pass lays the value out the same way.
export function toValidExactAttrValue(code: string, concise: boolean): Doc {
  if (isValidAttrValue(code, concise) === Validity.enclosed) return code;
  const enclosed = `(${code})`;
  return isValidAttrValue(enclosed, concise) === Validity.enclosed
    ? enclosed
    : `(\n${code}\n)`;
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
