import { type Doc, doc } from "prettier";

import type { ConciseSpace } from "./visible-space";

const b = doc.builders;
const traverseDoc = doc.utils.traverseDoc;

function docText(content: Doc) {
  let text = "";
  traverseDoc(content, (child) => {
    if (typeof child === "string") {
      text += child;
    } else if (!Array.isArray(child) && child.type === "line") {
      text += " ";
    }
  });

  return text;
}

function getFence(content: Doc, space: ConciseSpace) {
  const text = docText(content);
  const longestRun = Math.max(
    0,
    ...Array.from(text.matchAll(/`+/g), ([run]) => run.length),
  );

  return {
    open: "`".repeat(longestRun + 1),
    // A backtick right after the opening backticks would join them.
    needsBlock: text.startsWith("`") && !space.leading,
    endsWithBacktick: text.endsWith("`"),
  };
}

export function printBacktickBody(content: Doc, space: ConciseSpace = {}) {
  const { open, needsBlock } = getFence(content, space);
  return [
    " ",
    open,
    needsBlock ? b.breakParent : "",
    b.indent([b.softline, space.leading ?? "", content, space.trailing ?? ""]),
    space.trailing ? b.ifBreak("", open) : "",
  ];
}

export function wrapConciseText(
  content: Doc,
  {
    space = {},
    trailingComment,
  }: { space?: ConciseSpace; trailingComment?: string } = {},
) {
  const { open, needsBlock, endsWithBacktick } = getFence(content, space);
  const closesOnOneLine =
    space.trailing !== undefined ||
    (trailingComment !== undefined && !endsWithBacktick);
  return b.group([
    open,
    needsBlock ? b.breakParent : "",
    b.softline,
    // The fence is on its own line, so the first line's indentation is not read as the block's.
    space.leading ? " " : "",
    content,
    space.trailing ?? "",
    b.ifBreak([b.line, open], closesOnOneLine ? open : ""),
    trailingComment === undefined
      ? ""
      : b.ifBreak([b.line, trailingComment], [" ", trailingComment]),
  ]);
}
