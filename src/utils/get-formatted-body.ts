import { type AstPath, type Doc, doc, type Options } from "prettier";

import { type Node, NodeType } from "../parser";
import { read } from "./read";
const placeholderReg = /MARKO_(\d+)_/g;
const { mapDoc } = doc.utils;
export async function getFormattedBody(
  tag: AstPath<Node.Tag>,
  parser: Options["parser"] | false,
  toDoc: (text: string, options: Options) => Promise<Doc>,
  print: (selector: AstPath) => Doc,
  opts: Options,
) {
  let pid = 0;
  let code = "";
  let placeholders: Doc[] | undefined;
  tag.each((child) => {
    if (child.node.type === NodeType.Placeholder) {
      code += `MARKO_${pid++}_`;
      (placeholders ||= []).push(print(child));
    } else {
      code += read(child.node, opts);
    }
  }, "body");

  const doc = parser ? await toDoc(code, { parser }) : code;
  return !placeholders
    ? doc
    : mapDoc(doc, (cur) => {
        if (typeof cur === "string") {
          let match = placeholderReg.exec(cur);

          if (match) {
            const replacementDocs = [] as Doc[];
            let index = 0;

            do {
              const placeholderIndex = +match[1];

              if (index !== match.index) {
                replacementDocs.push(cur.slice(index, match.index));
              }

              replacementDocs.push(placeholders![placeholderIndex]);
              index = match.index + match[0].length;
            } while ((match = placeholderReg.exec(cur)));

            if (index !== cur.length) {
              replacementDocs.push(cur.slice(index));
            }

            if (replacementDocs.length === 1) {
              return replacementDocs[0];
            }

            return replacementDocs;
          }
        }

        return cur;
      });
}
