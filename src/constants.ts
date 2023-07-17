import type * as Compiler from "@marko/compiler";

declare module "prettier" {
  interface Options {
    markoSyntax?: "auto" | "html" | "concise";
    markoAttrParen?: boolean;
  }

  interface ParserOptions {
    markoCompiler?: typeof Compiler;
    markoCompilerConfig?: Compiler.Config;
    markoSyntax?: "auto" | "html" | "concise";
    markoAttrParen?: boolean;
    // @internal
    markoLinePositions: number[];
    // @internal
    markoScriptParser: string;
    // @internal
    markoPreservingSpace: boolean;
  }
}

export type MarkoEmbedNode = {
  type: "_MarkoEmbed";
  mode: string;
  code: string;
  loc: undefined;
};

export type Node = Compiler.types.Node | MarkoEmbedNode;

export const enclosedNodeTypeReg =
  /^(?:Identifier|.*Literal|(?:Object|Array|Parenthesized|Record|Tuple)Expression)$/;
export const styleReg = /^style((?:\.[^\s\\/:*?"<>|({]+)+)?\s*\{?/;
export const voidHTMLReg =
  /^(?:area|b(?:ase|r)|col|embed|hr|i(?:mg|nput)|keygen|link|meta|param|source|track|wbr)$/;
export const shorthandIdOrClassReg =
  /^[a-zA-Z0-9_$][a-zA-Z0-9_$-]*(?:\s+[a-zA-Z0-9_$][a-zA-Z0-9_$-]*)*$/;
export const preserveSpaceTagsReg = /^(?:textarea|pre)$/;
