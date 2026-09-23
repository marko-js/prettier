import { escapeText } from "htmljs-parser";
import { type Doc, doc, type Options } from "prettier";

const b = doc.builders;
export const singleQuoteSpace = "${' '}";
export const doubleQuoteSpace = '${" "}';
const singleQuoteSpaceIfBreak = b.ifBreak([singleQuoteSpace, b.line], " ");
const doubleQuoteSpaceIfBreak = b.ifBreak([doubleQuoteSpace, b.line], " ");
export function ensureVisibleSpace(parts: Doc[], opts: Options) {
  if (parts[0] === b.line) {
    parts[0] = getVisibleSpace(opts);
  }

  const last = parts.length - 1;
  if (parts[last] === b.line) {
    parts[last] = getVisibleSpace(opts);
    if (typeof parts[last - 1] === "string") {
      parts[last - 1] = escapeTrailingBackslashes(
        parts[last - 1] as string,
        opts,
      );
    }
  }
}

export function ensureVisibleTrailingSpace(parts: Doc[], opts: Options) {
  const last = parts.length - 1;
  if (typeof parts[last] === "string" && /[ \t]$/.test(parts[last])) {
    parts[last] =
      escapeTrailingBackslashes(parts[last].slice(0, -1), opts) +
      getVisibleSpace(opts);
  }
}

export function ensureVisibleSpaceBetweenTags(parts: Doc[], opts: Options) {
  const last = parts.length - 1;
  if (last > 0 && parts[last] === b.line) {
    if (typeof parts[last - 1] !== "string") {
      parts[last] = opts.singleQuote
        ? singleQuoteSpaceIfBreak
        : doubleQuoteSpaceIfBreak;
    }
  }
}

export function getVisibleSpace(opts: Options) {
  return opts.singleQuote ? singleQuoteSpace : doubleQuoteSpace;
}

export function isVisibleSpace(code: string) {
  switch (code) {
    case singleQuoteSpace:
    case doubleQuoteSpace:
      return true;
    default:
      return false;
  }
}

// The visible space is a placeholder, which a backslash run ending the
// already printed text would escape.
function escapeTrailingBackslashes(text: string, opts: Options) {
  return text.replace(/\\+$/, (run) => escapeText(run, getVisibleSpace(opts)));
}
