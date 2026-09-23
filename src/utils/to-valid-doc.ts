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

// A line comment followed by more of the template would swallow it, so it is
// printed as a block comment instead, which a `*/` in its text would end early.
export function toBlockComment(text: string) {
  return `/* ${text.trim().replaceAll("*/", "*\\/")} */`;
}

// A trailing line comment, which htmljs-parser folds into a tag var, would
// swallow the rest of the open tag, and a tag var cannot be parenthesized like
// an attr value, so the comment is moved into a block comment after it.
export function splitTagVarComment(code: string): [code: string, comment: Doc] {
  // Text after a line comment is read as part of the value.
  if (isValidAttrValue(`${code} _`, false) !== Validity.invalid) {
    for (let i = code.indexOf("//"); i !== -1; i = code.indexOf("//", i + 2)) {
      const value = code.slice(0, i).trimEnd();
      if (
        value &&
        isValidAttrValue(value, false) !== Validity.invalid &&
        isValidAttrValue(`${value} _`, false) === Validity.invalid
      ) {
        const text = code.slice(i + 2);
        return [value, text.trim() ? [" ", toBlockComment(text)] : ""];
      }
    }
  }

  return [code, ""];
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
