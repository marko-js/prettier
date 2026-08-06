import type { Range } from "@marko/parse";
import type { Options } from "prettier";
export function read(range: Range, opts: Options) {
  return opts._markoParsed!.read(range);
}
