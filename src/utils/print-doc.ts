import type { Doc } from "prettier";
const DocCache = new WeakMap<Doc & object, string>();

export default function printDoc(doc: Doc): string {
  switch (typeof doc) {
    case "string":
      return doc;
    case "object":
      if (doc !== null) {
        let cached = DocCache.get(doc);
        if (cached !== undefined) return cached;
        if (Array.isArray(doc)) {
          cached = "";
          for (const item of doc) {
            cached += printDoc(item);
          }
        } else {
          switch (doc.type) {
            case "align":
              cached = `\n${printDoc(doc.contents)}\n`;
              break;
            case "indent":
              cached = ` ${printDoc(doc.contents)} `;
              break;
            case "break-parent":
            case "cursor":
            case "line-suffix-boundary":
            case "trim":
              cached = "";
              break;
            case "fill":
              cached = ` ${printDoc(doc.parts)} `;
              break;
            case "group":
              cached = printDoc(doc.contents) + printDoc(doc.expandedStates);
              break;
            case "if-break":
              cached = printDoc(doc.flatContents) + printDoc(doc.breakContents);
              break;
            case "indent-if-break":
              cached = " ";
              break;
            case "label":
            case "line-suffix":
              cached = printDoc(doc.contents);
              break;
            case "line":
            default:
              cached = "\n";
              break;
          }
        }

        DocCache.set(doc, cached);
        return cached;
      }
  }

  return "";
}
