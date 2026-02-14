import type { Options } from "prettier";

import type { Range } from "../parser";
export function read(range: Range, opts: Options) {
  return opts._markoParsed!.read(range);
}
