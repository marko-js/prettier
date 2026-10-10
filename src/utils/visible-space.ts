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

export interface ConciseSpace {
  leading?: Doc;
  trailing?: Doc;
}

/**
 * Concise text can hold its leading and trailing whitespace literally on one
 * line, which then needs closing backticks. Where the text breaks, a placeholder
 * stands in for it instead: the printer trims whitespace before a break, and a
 * block's indentation is read from its first line.
 *
 * The whitespace is taken out of the parts and returned, to be printed around
 * them.
 */
export function takeLiteralSpace(parts: Doc[], opts: Options): ConciseSpace {
  const trailing = takeTrailingSpace(parts, opts);
  let leading: Doc | undefined;
  if (parts[0] === b.line) {
    parts.shift();
    leading = literalOrVisibleSpace(opts);
  }

  return { leading, trailing };
}

function literalOrVisibleSpace(opts: Options) {
  return b.ifBreak(getVisibleSpace(opts), " ");
}

function takeTrailingSpace(parts: Doc[], opts: Options) {
  const last = parts.length - 1;
  const lastPart = parts[last];
  let spaces = "";

  if (lastPart === b.line) {
    parts.pop();
    spaces = " ";
  } else if (typeof lastPart === "string") {
    const trimmed = lastPart.replace(/[ \t]+$/, "");
    spaces = lastPart.slice(trimmed.length);
    parts[last] = trimmed;
  }

  if (!spaces) return;

  let backslashes = "";
  const before = parts[parts.length - 1];
  if (spaces.length === 1 && typeof before === "string") {
    const trimmed = before.replace(/\\+$/, "");
    backslashes = before.slice(trimmed.length);
    parts[parts.length - 1] = trimmed;
  }

  const visibleSpace = getVisibleSpace(opts);
  return b.ifBreak(
    escapeText(backslashes, visibleSpace) + spaces.slice(0, -1) + visibleSpace,
    backslashes + spaces,
  );
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
