import type { Options } from "prettier";

import { type Node, NodeType } from "../parser";
import { read } from "./read";

export function getParserFromExt(ext: string) {
  switch (ext) {
    case ".css":
      return "css";
    case ".less":
      return "less";
    case ".scss":
      return "scss";
    case ".js":
    case ".mjs":
    case ".cjs":
      return "babel";
    case ".ts":
    case ".mts":
    case ".cts":
      return "babel-ts";
    default:
      return false;
  }
}

export function hasTagParser(tag: Node.Tag) {
  switch (tag.nameText) {
    case "script":
    case "html-script":
    case "style":
    case "html-style":
      return true;
    default:
      return false;
  }
}

export function getTagParser(tag: Node.Tag, opts: Options) {
  switch (tag.body && tag.nameText) {
    case "script":
    case "html-script":
      return getScriptTagParser(tag, opts);
    case "style":
      return getStyleTagParser(tag, opts);
    case "html-style":
      return "css";
  }
}

function getScriptTagParser(tag: Node.Tag, opts: Options): Options["parser"] {
  if (tag.attrs?.length) {
    for (const attr of tag.attrs) {
      if (
        attr.type === NodeType.AttrNamed &&
        attr.value?.type === NodeType.AttrValue &&
        read(attr.name, opts) === "type"
      ) {
        const { code } = opts._markoParsed!;
        const value = attr.value.value;
        const start = code.charAt(value.start);
        const type =
          (start === '"' || start === "'") &&
          start === code.charAt(value.end - 1)
            ? code.slice(value.start + 1, value.end - 1)
            : "";
        switch (type) {
          case "module":
          case "text/javascript":
          case "application/javascript":
            return "babel-ts";
          case "importmap":
          case "speculationrules":
          case "application/json":
            return "json";
          default:
            return false;
        }
      }
    }
  }

  return "babel-ts";
}

function getStyleTagParser(tag: Node.Tag, opts: Options) {
  return getParserFromExt(
    (tag.shorthandClassNames &&
      read(
        tag.shorthandClassNames[tag.shorthandClassNames.length - 1],
        opts,
      )) ||
      ".css",
  );
}
