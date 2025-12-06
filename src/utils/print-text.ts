import type { Doc } from "prettier";

/**
 * Extracts only the text content from a doc, ignoring all formatting nodes.
 * This is useful for checking actual text content like whether it ends with a space,
 * without being confused by layout directives like indent, group, etc.
 *
 * For line breaks, we assume the flat/unbroken case (where they become spaces).
 */
export default function printText(doc: Doc): string {
  switch (typeof doc) {
    case "string":
      return doc;
    case "object":
      if (doc !== null) {
        if (Array.isArray(doc)) {
          let result = "";
          for (const item of doc) {
            result += printText(item);
          }
          return result;
        } else {
          switch (doc.type) {
            case "align":
            case "indent":
            case "label":
            case "line-suffix":
            case "group":
              return printText(doc.contents);
            case "fill":
              return printText(doc.parts);
            case "if-break":
              return printText(doc.flatContents);
            case "line":
              return doc.hard || doc.literal ? "\n" : " ";
          }
        }
      }
  }

  return "";
}
