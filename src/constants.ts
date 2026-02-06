declare module "prettier" {
  interface Options {
    markoSyntax?: "auto" | "html" | "concise";
    markoAttrParen?: boolean;
  }

  interface ParserOptions {
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

export const scriptParser = "babel-ts";
export const expressionParser = "__ts_expression";
export const enclosedNodeTypeReg =
  /^(?:Identifier|.*Literal|(?:Object|Array|Record|Tuple)Expression)$/;
export const styleReg = /^style((?:\.[^\s\\/:*?"<>|({]+)+)?\s*\{?/;
export const voidHTMLReg =
  /^(?:area|b(?:ase|r)|col|embed|hr|i(?:mg|nput)|keygen|link|meta|param|source|track|wbr|const|debug|id|let|lifecycle|log|return)$/;
export const shorthandIdOrClassReg =
  /^[a-zA-Z0-9_$][a-zA-Z0-9_$-]*(?:\s+[a-zA-Z0-9_$][a-zA-Z0-9_$-]*)*$/;
export const preserveSpaceTagsReg =
  /^(?:textarea|pre|html-(?:comment|script|style))$/;
