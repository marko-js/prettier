import { Doc, doc } from "prettier";
const { builders: b } = doc;
let temp: Doc[] = [""];

/**
 * Normalizes newlines and backslashes to work in a printed document.
 */
export default function asLiteralTextContent(val: string): Doc {
  let charPos = 0;
  let slotPos = 0;

  for (let i = 0, len = val.length; i < len; i++) {
    switch (val.charAt(i)) {
      case "\\":
        temp.push("\\\\");
        break;
      case "\n":
        temp.push(b.literalline);
        break;
      default:
        continue;
    }

    temp[slotPos] = val.slice(charPos, i);
    slotPos = temp.push("") - 1;
    charPos = i + 1;
  }

  if (charPos) {
    const result = temp;
    result[slotPos] = val.slice(charPos);
    temp = [""];
    return result;
  } else {
    return val;
  }
}
