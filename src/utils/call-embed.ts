import { AstPath, Doc } from "prettier";
import { Node, MarkoEmbedNode } from "../constants";

type NodeWithEmbed = Node & { _embed?: MarkoEmbedNode };

export default function callEmbed(
  print: (path: AstPath<NodeWithEmbed>) => Doc,
  path: AstPath<NodeWithEmbed>,
  mode: string,
  code: string
): Doc {
  const node = path.getValue();

  if (!code.trim()) {
    return "";
  }

  node._embed = {
    type: "_MarkoEmbed",
    mode,
    code,
    loc: undefined,
  };

  try {
    return path.call(print, "_embed");
  } finally {
    node._embed = undefined;
  }
}
