import {
  type AstPath,
  type Doc,
  doc,
  type Options,
  type Parser,
  type ParserOptions,
  type Printer,
  type SupportLanguage,
  type SupportOptions,
} from "prettier";

import {
  type Node,
  NodeType,
  parse as parseMarko,
  type Parsed,
  TagType,
} from "./parser";
import { getFormattedBody } from "./utils/get-formatted-body";
import {
  getParserFromExt,
  getTagParser,
  hasTagParser,
} from "./utils/get-parser-name";
import { read } from "./utils/read";
import {
  ensureVisibleSpace,
  ensureVisibleSpaceBetweenTags,
  ensureVisibleTrailingSpace,
  getVisibleSpace,
  isVisibleSpace,
} from "./utils/visible-space";
import withBlockIfNeeded from "./utils/with-block-if-needed";
import withParensIfNeeded from "./utils/with-parens-if-needed";

declare module "prettier" {
  interface Options {
    markoSyntax?: "auto" | "html" | "concise";
    _markoParsed?: Parsed;
  }

  interface ParserOptions {
    markoSyntax?: "auto" | "html" | "concise";
    _markoParsed?: Parsed;
  }
}

type AnyNode = Node.AnyNode;
type PrintFn<T extends AnyNode> = (
  path: AstPath<T>,
  opts: ParserOptions<AnyNode>,
  print: (path: AstPath<AnyNode>) => Doc,
) => Doc;
type EmbedFn = Extract<
  ReturnType<NonNullable<Printer<AnyNode>["embed"]>>,
  (...args: any[]) => any
>;

type Body = ReturnType<typeof printBody>;

const b = doc.builders;
const traverseDoc = doc.utils.traverseDoc;
const stmtParse = { parser: "babel-ts" } satisfies Options;
const exprParse = { parser: "__ts_expression" } satisfies Options;
const noVisitorKeys = [] as const;
const tagVisitorKeys = [
  "name",
  "shorthandId",
  "shorthandClassNames",
  "var",
  "args",
  "typeArgs",
  "params",
  "typeParams",
  "attrs",
  "body",
] as const satisfies (keyof Node.Tag)[];
const visitorKeys = {
  [NodeType.Tag]: tagVisitorKeys,
  [NodeType.AttrTag]: tagVisitorKeys,
  [NodeType.Program]: [
    "static",
    "body",
  ] as const satisfies (keyof Node.Program)[],
  [NodeType.AttrNamed]: [
    "args",
    "value",
  ] as const satisfies (keyof Node.AttrNamed)[],
} as const;

export const languages: SupportLanguage[] = [
  {
    name: "marko",
    aceMode: "text",
    parsers: ["marko"],
    aliases: ["markojs"],
    tmScope: "text.marko",
    codemirrorMode: "htmlmixed",
    vscodeLanguageIds: ["marko"],
    linguistLanguageId: 932782397,
    codemirrorMimeType: "text/html",
    extensions: [".marko"],
  },
];

export const options: SupportOptions = {
  markoSyntax: {
    type: "choice",
    default: "auto",
    category: "Marko",
    description:
      "Change output syntax between HTML mode, concise mode and auto.",
    choices: [
      {
        value: "auto",
        description: "Determine output syntax by the input syntax used.",
      },
      {
        value: "html",
        description: "Force the output to use the HTML syntax.",
      },
      {
        value: "concise",
        description: "Force the output to use the concise syntax.",
      },
    ],
  },
};

export const parsers: Record<string, Parser<AnyNode>> = {
  marko: {
    astFormat: "marko-ast",
    parse(text, opts) {
      const { program } = (opts._markoParsed = parseMarko(text, opts.filepath));

      if (opts.markoSyntax === "auto") {
        opts.markoSyntax = "html";

        for (const child of program.body) {
          if (child.type === NodeType.Tag) {
            if (child.concise) opts.markoSyntax = "concise";
            break;
          }
        }
      }

      return program;
    },
    locStart(node) {
      return node.start;
    },
    locEnd(node) {
      return node.end;
    },
  },
};

export const printers: Record<string, Printer<AnyNode>> = {
  "marko-ast": {
    print(path, opts, print) {
      const { node } = path;
      switch (node.type) {
        case NodeType.AttrArgs:
        case NodeType.AttrMethod:
        case NodeType.AttrNamed:
        case NodeType.AttrSpread:
        case NodeType.Class:
        case NodeType.Export:
        case NodeType.Import:
        case NodeType.OpenTagName:
        case NodeType.Placeholder:
        case NodeType.Scriptlet:
        case NodeType.ShorthandClassName:
        case NodeType.ShorthandId:
        case NodeType.Static:
        case NodeType.Style:
        case NodeType.TagArgs:
        case NodeType.TagParams:
        case NodeType.TagTypeArgs:
        case NodeType.TagTypeParams:
        case NodeType.TagVar:
          return printExact(path, opts, print);
        case NodeType.CDATA:
          return printCDATA(path as AstPath<Node.CDATA>, opts, print);
        case NodeType.Comment:
          return printComment(path as AstPath<Node.Comment>, opts, print);
        case NodeType.Doctype:
          return printDoctype(path as AstPath<Node.Doctype>, opts, print);
        case NodeType.Declaration:
          return printDeclaration(
            path as AstPath<Node.Declaration>,
            opts,
            print,
          );
        case NodeType.Program:
          return printProgram(path as AstPath<Node.Program>, opts, print);
        case NodeType.Tag:
        case NodeType.AttrTag:
          return printTag(
            path as AstPath<Node.Tag | Node.AttrTag>,
            opts,
            print,
          );
        case NodeType.Text:
          return printText(path as AstPath<Node.Text>, opts, print);
        default:
          throw new Error(
            `Unknown node type in Marko template: ${NodeType[node.type] || node.type}`,
          );
      }
    },
    embed(path, opts) {
      switch (path.node?.type as NodeType | undefined) {
        case NodeType.AttrNamed:
          return embedAttrNamed;
        case NodeType.AttrSpread:
          return embedAttrSpread;
        case NodeType.Class:
          return embedClass;
        case NodeType.Export:
          return embedExport;
        case NodeType.Import:
          return embedImport;
        case NodeType.OpenTagName:
          return embedOpenTagName;
        case NodeType.Placeholder:
          return embedPlaceholder;
        case NodeType.Scriptlet:
          return embedScriptlet;
        case NodeType.ShorthandClassName:
          return embedShorthandClassName;
        case NodeType.ShorthandId:
          return embedShorthandId;
        case NodeType.Static:
          return embedStatic;
        case NodeType.Style:
          return embedStyle;
        case NodeType.Tag:
          return embedTag(path, opts);
        case NodeType.TagArgs:
          return embedTagArgs;
        case NodeType.TagParams:
          return embedTagParams;
        case NodeType.TagTypeArgs:
          return embedTagTypeArgs;
        case NodeType.TagTypeParams:
          return embedTagTypeParams;
        case NodeType.TagVar:
          return embedTagVar;
      }

      return null;
    },
    getVisitorKeys(node) {
      return (
        visitorKeys[node.type as keyof typeof visitorKeys] || noVisitorKeys
      );
    },
  },
};

const printProgram: PrintFn<Node.Program> = (path, opts, print) => {
  const body = printBody(path, opts, print);
  const lastStatic = path.node.static.length - (body ? 0 : 1);
  let programDoc = path.map(
    (child, i) =>
      i !== lastStatic && hasExplicitLine(child, opts)
        ? [child.call(print), b.hardline]
        : child.call(print),
    "static",
  );

  if (body) {
    if (body.inline) {
      programDoc.push(wrapConciseText(body.content));
    } else {
      programDoc = [...programDoc, ...body.content];
    }
  }

  return [b.join(b.hardline, programDoc), b.hardline];
};

const printDoctype: PrintFn<Node.Doctype> = (path, opts) => {
  return `<!${read(path.node.value, opts).replace(/\s+/g, " ").trim()}>`;
};

const printDeclaration: PrintFn<Node.Declaration> = (path, opts) => {
  return `<?${read(path.node.value, opts).trim()}?>`;
};

const printCDATA: PrintFn<Node.CDATA> = (path, opts) => {
  return `<![CDATA[${read(path.node.value, opts)}]]>`;
};

const printComment: PrintFn<Node.Comment> = (path, opts) => {
  const { node } = path;
  const code = read(node, opts);
  if (node.block) {
    if (code.includes("\n")) {
      const lines = code.split("\n");
      const len = lines.length;
      let indent = Infinity;

      for (let i = 1; i < len; i++) {
        const match = lines[i].match(/^(\s+)/);
        if (match) {
          indent = Math.min(indent, match[1].length);
        } else {
          indent = 0;
          break;
        }
      }

      const parts: Doc[] = [lines[0]];
      for (let i = 1; i < len; i++) {
        parts.push(b.hardline, indent ? lines[i].slice(indent) : lines[i]);
      }
      return parts;
    }

    return code;
  }

  return b.lineSuffix(code);
};

const printTag = ((
  path,
  opts,
  print,
  body: Body = printBody(path, opts, print),
) => {
  return (isConcise(opts) ? printConciseTag : printHTMLTag)(
    path,
    opts,
    print,
    body,
  );
}) satisfies PrintFn<Node.Tag | Node.AttrTag>;

const printHTMLTag = ((path, opts, print, body?: Body) => {
  const { node } = path;
  const openTagDoc: Doc[] = ["<", printTagBeforeAttrs(path, opts, print)];

  if (node.attrs) {
    const hasDefault = isDefaultAttr(node.attrs[0]);
    let attrsDocs = path.map(print, "attrs");

    if (hasDefault) {
      openTagDoc.push(attrsDocs[0]);
      attrsDocs = attrsDocs.slice(1);
    }

    if (attrsDocs.length) {
      if (attrsDocs.length === 1 && !(hasDefault || node.params || node.args)) {
        openTagDoc.push(" ", attrsDocs[0]);
      } else {
        openTagDoc.push(
          b.indent([b.line, b.join(b.line, attrsDocs)]),
          b.softline,
        );
      }
    }
  }

  openTagDoc.push(body || node.bodyType === TagType.void ? ">" : "/>");

  if (body) {
    const bodyLine = body.inline ? b.softline : b.hardline;
    const closeTagDoc = `</${node.name.expressions.length ? "" : read(node.name, opts)}>`;
    if (body.preserve) {
      return b.group([b.group(openTagDoc), body.content, closeTagDoc]);
    }

    return b.group([
      b.group(openTagDoc),
      b.indent([
        bodyLine,
        body.inline ? body.content : b.join(bodyLine, body.content),
      ]),
      bodyLine,
      closeTagDoc,
    ]);
  }

  return b.group(openTagDoc);
}) satisfies PrintFn<Node.Tag | Node.AttrTag>;

const printConciseTag = ((path, opts, print, body?: Body) => {
  const { node } = path;
  const tagDoc: Doc[] = [printTagBeforeAttrs(path, opts, print)];

  if (node.attrs) {
    const hasDefault = isDefaultAttr(node.attrs[0]);
    let attrsDocs = path.map(print, "attrs");
    if (hasDefault) {
      tagDoc.push(attrsDocs[0]);
      attrsDocs = attrsDocs.slice(1);
    }
    if (attrsDocs.length) {
      if (attrsDocs.length === 1 && !(hasDefault || node.params || node.args)) {
        tagDoc.push(" ", attrsDocs[0]);
      } else {
        const attrsDoc: Doc[] = [];
        for (const attrDoc of attrsDocs) {
          attrsDoc.push(b.line, b.ifBreak(","), attrDoc);
        }
        tagDoc.push(b.group(b.indent(attrsDoc)));
      }
    }
  }

  if (body) {
    tagDoc.push(
      b.group(
        body.inline
          ? body.preserve
            ? b.indent([b.line, wrapConciseText(body.content)])
            : [" --", b.indent([b.line, body.content])]
          : b.indent([b.hardline, b.join(b.hardline, body.content)]),
      ),
    );
  }

  return b.group(tagDoc);
}) satisfies PrintFn<Node.Tag | Node.AttrTag>;

const printTagBeforeAttrs: PrintFn<Node.Tag | Node.AttrTag> = (
  path,
  _opts,
  print,
) => {
  const { node } = path;
  const name = path.call(print, "name");
  const doc: Doc[] = [name];

  if (pathHas(path, "typeArgs")) {
    doc.push(path.call(print, "typeArgs"));
  }

  if (pathHas(path, "shorthandId")) {
    doc.push(path.call(print, "shorthandId"));
  }

  if (pathHas(path, "shorthandClassNames")) {
    doc.push(path.map(print, "shorthandClassNames"));
  }

  if (pathHas(path, "args")) {
    doc.push(path.call(print, "args"));
  }

  if (pathHas(path, "var")) {
    doc.push(path.call(print, "var"));
  }

  if (pathHas(path, "params")) {
    if (pathHas(path, "typeParams")) {
      if (!(node.typeArgs || node.args || node.var)) {
        doc.push(" ");
      }
      doc.push(path.call(print, "typeParams"));
    }
    doc.push(path.call(print, "params"));
  }

  return doc.length === 1 ? name : doc;
};

const printBody = (
  path: AstPath<Node.ParentNode>,
  opts: Options,
  print: (path: AstPath<Node.AnyNode>) => Doc,
) => {
  const { node } = path;
  if (!node.body) return;

  const concise = !node.parent || isConcise(opts);
  const isInline = concise ? isTextLike : isInlineHTML;
  const preserve = hasPreservedText(node);
  let content: Doc[] | undefined;
  let inline: doc.builders.Fill["parts"] | undefined;
  let inlineIndex = -1;

  if (preserve) {
    path.each((child) => {
      const childDoc = child.call(print);
      if (!childDoc) return;
      content ||= [];

      if (isInline(child.node)) {
        if (!inline) {
          inline = [];
          inlineIndex = content.push(inline) - 1;
        }

        if (child.node.type === NodeType.Text && typeof childDoc === "string") {
          const nl = isConcise(opts) ? b.hardline : b.literalline;
          let lineStart = 0;
          for (let i = 0; i < childDoc.length; i++) {
            if (childDoc.charAt(i) === "\n") {
              if (lineStart !== i) {
                inline.push(childDoc.slice(lineStart, i));
              }

              inline.push(nl);
              lineStart = i + 1;
            }
          }

          if (!lineStart) {
            inline.push(childDoc);
          } else if (lineStart !== childDoc.length) {
            inline.push(childDoc.slice(lineStart));
          }
        } else {
          inline.push(childDoc);
        }
      } else {
        if (inline) {
          if (concise) {
            ensureVisibleTrailingSpace(inline, opts);
            content[inlineIndex] = wrapConciseText(content[inlineIndex]);
          }

          inline = undefined;
        }

        content.push(childDoc);
      }
    }, "body");

    if (inline && concise) {
      ensureVisibleTrailingSpace(inline, opts);
    }
  } else {
    let isInlineTag = false;
    let isExplicitLine = false;
    path.each((child) => {
      const wasInlineTag = isInlineTag;
      const inlineChild = isInline(child.node);
      let childDoc = child.call(print);
      if (child.node.type === NodeType.Text && typeof childDoc === "string") {
        childDoc = trimText(childDoc, child as AstPath<Node.Text>);
      }

      if (!childDoc) return;

      isInlineTag = false;
      content ||= [];

      if (isExplicitLine) {
        const last = content.length - 1;
        isExplicitLine = false;
        content[last] = [content[last], b.hardline];
      }

      if (inlineChild) {
        if (!inline) {
          inline = [];
          inlineIndex = content.push(b.fill(inline)) - 1;
        }

        switch (child.node.type) {
          case NodeType.Text:
            if (typeof childDoc === "string") {
              const len = childDoc.length;
              let start = 0;
              for (let i = 0; i < len; i++) {
                if (childDoc.charAt(i) === " ") {
                  if (start !== i) {
                    inline.push(childDoc.slice(start, i));
                  }

                  if (i || !endsWithLine(inline)) {
                    inline.push(b.line);
                  }

                  start = i + 1;
                }
              }

              if (start === len) return;
              if (start) childDoc = childDoc.slice(start);
            }
            break;

          case NodeType.Placeholder:
            if (typeof childDoc === "string" && isVisibleSpace(childDoc)) {
              if (endsWithLine(inline)) {
                const last = inline.length - 1;
                if (inline[last] === b.softline) {
                  inline[last] = b.line;
                }

                return;
              }

              childDoc = b.line;
            }
            break;

          case NodeType.Tag:
            isInlineTag = true;
            ensureVisibleSpaceBetweenTags(inline, opts);

            if (wasInlineTag) {
              inline.push(b.softline);
            }

            break;
        }

        inline.push(childDoc);
      } else {
        isExplicitLine = !child.isLast && hasExplicitLine(child, opts);

        if (inline) {
          ensureVisibleSpace(inline, opts);
          inline = undefined;

          if (concise) {
            content[inlineIndex] = wrapConciseText(content[inlineIndex]);
          }
        }

        content.push(childDoc);
      }
    }, "body");
  }

  if (content) {
    if (inline) {
      ensureVisibleSpace(inline, opts);

      if (inlineIndex === 0) {
        return {
          inline: true,
          preserve,
          content: content[inlineIndex],
        } as const;
      }

      if (concise) {
        content[inlineIndex] = wrapConciseText(content[inlineIndex]);
      }
    }

    return {
      inline: false,
      preserve,
      content,
    } as const;
  }
};

const printText: PrintFn<Node.Text> = (path, opts) => {
  const text = read(path.node, opts).replace(/\\/g, "\\\\");
  if (/^\$!?{/.test(text)) return "\\" + text;
  return text;
};
const printExact: PrintFn<AnyNode> = (path, opts) => read(path.node, opts);

const embedClass: EmbedFn = (toDoc, _print, path, opts) =>
  toDoc(read(path.node, opts), exprParse);

const embedImport: EmbedFn = (toDoc, _print, path, opts) =>
  toDoc(read(path.node, opts), stmtParse);

const embedExport: EmbedFn = (toDoc, _print, path, opts) =>
  toDoc(read(path.node, opts), stmtParse);

const embedStyle: EmbedFn = async (toDoc, _print, path, opts) => {
  const node = path.node as Node.Style;
  const code = read(node.value, opts).trim();
  const parser = getParserFromExt(
    node.ext?.slice(node.ext.lastIndexOf(".")) || ".css",
  );

  if (parser) {
    return b.group([
      `style${node.ext || ""} {`,
      b.indent([b.line, await toDoc(code, { parser })]),
      b.line,
      "}",
    ]);
  }
};

const embedStatic: EmbedFn = async (toDoc, _print, path, opts) => {
  const node = path.node as Node.Static;
  const code = opts
    ._markoParsed!.code.slice(node.start + node.target.length + 1, node.end)
    .replace(/^\s*\{([\s\S]*)\}\s*$/, "$1")
    .trim();
  return code
    ? [`${node.target} `, withBlockIfNeeded(await toDoc(code, stmtParse))]
    : [];
};

const embedScriptlet: EmbedFn = async (toDoc, _print, path, opts) => {
  const node = path.node as Node.Scriptlet;
  const code = read(node.value, opts)
    .replace(/^\s*\{([\s\S]*)\}\s*$/, "$1")
    .trim();
  return code
    ? [b.breakParent, "$ ", withBlockIfNeeded(await toDoc(code, stmtParse))]
    : [];
};

const embedOpenTagName: EmbedFn = async (toDoc, _print, path, opts) =>
  embedTemplate(toDoc, _print, path, opts);

const embedPlaceholder: EmbedFn = async (toDoc, _print, path, opts) => {
  const node = path.node as Node.Placeholder;
  const code = read(node.value, opts);

  if (code === '" "' || code === "' '") {
    return getVisibleSpace(opts);
  }

  return b.group([
    "${",
    b.indent([b.softline, await toDoc(code, exprParse)]),
    b.softline,
    "}",
  ]);
};

const embedTagArgs: EmbedFn = (toDoc, _print, path, opts) => {
  return argsToDoc(path.node as Node.TagArgs, opts, toDoc);
};

const embedAttrNamed: EmbedFn = async (toDoc, _print, path, opts) => {
  const node = path.node as Node.AttrNamed;
  const name = read(node.name, opts);
  if (!(node.args || node.value)) return name;
  const attrDoc: Doc[] = [name];

  if (node.args) {
    const argsDoc = await argsToDoc(node.args, opts, toDoc);
    if (argsDoc) {
      attrDoc.push(argsDoc);
    } else {
      return unexpectedDoc(opts, node);
    }
  }

  if (node.value) {
    if (node.value.type === NodeType.AttrMethod) {
      const attrMethodDoc = await toDoc(
        `function${read(node.value, opts)}`,
        exprParse,
      );

      if (
        Array.isArray(attrMethodDoc) &&
        attrMethodDoc.length &&
        typeof attrMethodDoc[0] === "string"
      ) {
        attrMethodDoc[0] = (attrMethodDoc[0] as string).replace(
          /^function\s*/,
          "",
        );
        attrDoc.push(attrMethodDoc);
      } else {
        return unexpectedDoc(opts, node);
      }
    } else {
      attrDoc.push(
        node.value.bound ? ":=" : "=",
        withParensIfNeeded(
          await toDoc(read(node.value.value, opts), exprParse),
          isConcise(opts),
        ),
      );
    }
  }
  return b.group(attrDoc);
};

const embedAttrSpread: EmbedFn = async (toDoc, _print, path, opts) => {
  const node = path.node as Node.AttrSpread;
  return b.group([
    "...",
    withParensIfNeeded(
      await toDoc(read(node.value, opts), exprParse),
      isConcise(opts),
    ),
  ]);
};

const embedShorthandId: EmbedFn = async (toDoc, print, path, opts) => [
  "#",
  (await embedTemplate(toDoc, print, path, opts))!,
];

const embedShorthandClassName: EmbedFn = async (toDoc, print, path, opts) => [
  ".",
  (await embedTemplate(toDoc, print, path, opts))!,
];

const embedTag = (path: AstPath<Node.Tag>, opts: Options): EmbedFn | null => {
  const tag = path.node;
  const parser = getTagParser(tag, opts);
  if (parser === undefined) return null;
  return async (toDoc, print, path, opts) =>
    printTag(path, opts as ParserOptions<Node.AnyNode>, print, {
      inline: true,
      preserve: parser === false,
      content: await getFormattedBody(path, parser, toDoc, print, opts),
    });
};

const embedTagVar: EmbedFn = async (toDoc, _print, path, opts) => {
  const node = path.node as Node.TagVar;
  const code = read(node.value, opts).trim();
  if (code) {
    let doc = await toDoc(`var ${code}=_`, stmtParse);

    if (Array.isArray(doc) && doc.length === 1) {
      doc = doc[0];
    }

    if (
      typeof doc === "object" &&
      !Array.isArray(doc) &&
      doc.type === "group"
    ) {
      doc = doc.contents;
    }
    if (Array.isArray(doc) && doc.length > 1) {
      const varPart = doc[1];
      if (
        typeof varPart === "object" &&
        "type" in varPart &&
        varPart.type === "group" &&
        Array.isArray(varPart.contents)
      ) {
        const varContents = varPart.contents;
        for (let i = varContents.length; i--; ) {
          const item = varContents[i];
          if (typeof item === "string") {
            // Walks back until we find the equals sign.
            const match = /\s*=\s*$/.exec(item);
            if (match) {
              varContents[i] = item.slice(0, -match[0].length);
              varContents.length = i + 1;
              return ["/", varContents];
            }
          }
        }
      }
    }

    return unexpectedDoc(opts, node);
  }

  return [];
};

const embedTagTypeArgs: EmbedFn = async (toDoc, _print, path, opts) => {
  const node = path.node as Node.TagTypeArgs;
  const code = read(node.value, opts).trim();
  if (code) {
    const doc = await toDoc(`_<${code}>`, exprParse);
    if (typeof doc === "string") {
      return doc.replace(/^_/, "");
    }

    if (Array.isArray(doc) && typeof doc[0] === "string") {
      doc[0] = doc[0].replace(/^_/, "");
      return doc;
    }

    return unexpectedDoc(opts, node);
  }

  return [];
};

const embedTagParams: EmbedFn = async (toDoc, _print, path, opts) => {
  const node = path.node as Node.TagParams;
  const code = read(node.value, opts).trim();
  if (code) {
    const doc = await toDoc(`function _(${code}){}`, stmtParse);
    if (Array.isArray(doc) && doc.length > 1) {
      const paramsGroup = doc[1];
      if (
        paramsGroup &&
        typeof paramsGroup === "object" &&
        "type" in paramsGroup &&
        paramsGroup.type === "group" &&
        Array.isArray(paramsGroup.contents)
      ) {
        const paramsContents = [...paramsGroup.contents];
        const first = paramsContents[0];
        const last = paramsContents[paramsContents.length - 1];
        if (typeof first === "string" && typeof last === "string") {
          paramsContents[0] = first.replace(/^\(/, "|");
          paramsContents[paramsContents.length - 1] = last.replace(/\)$/, "|");
        }

        return b.group(paramsContents);
      }
    }
    return unexpectedDoc(opts, node);
  }

  return [];
};

const embedTagTypeParams: EmbedFn = async (toDoc, _print, path, opts) => {
  const node = path.node as Node.TagTypeArgs;
  const code = read(node.value, opts).trim();
  if (code) {
    const doc = await toDoc(`function _<${code}>(){}`, stmtParse);
    if (Array.isArray(doc) && doc.length > 1) {
      return doc[1];
    }
    return unexpectedDoc(opts, node);
  }

  return [];
};

const embedTemplate: EmbedFn = async (toDoc, _print, path, opts) => {
  const { expressions, quasis } = path.node as
    | Node.ShorthandId
    | Node.ShorthandClassName
    | Node.OpenTagName;
  const first = read(quasis[0], opts);
  const len = expressions.length;
  if (!len) return first;

  const shorthandDoc: Doc[] = [first];
  for (let i = 0; i < len; i++) {
    const quasi = read(quasis[i + 1], opts);
    const expr = read(expressions[i].value, opts);
    shorthandDoc.push(
      b.group([
        "${",
        b.indent([b.softline, await toDoc(expr, exprParse)]),
        b.softline,
        "}",
      ]),
    );

    if (quasi) {
      shorthandDoc.push(quasi);
    }
  }

  return shorthandDoc;
};

async function argsToDoc(
  node: Node.TagArgs | Node.AttrArgs,
  opts: Options,
  toDoc: (text: string, options: Options) => Promise<Doc>,
) {
  const code = read(node.value, opts).trim();
  if (code) {
    const doc = await toDoc(`_(${code})`, exprParse);
    if (Array.isArray(doc) && doc.length && typeof doc[0] === "string") {
      doc[0] = doc[0].replace(/^_/, "");
      return doc;
    }
    return unexpectedDoc(opts, node);
  }

  return [];
}

function wrapConciseText(doc: Doc) {
  let maxDashes = 0;
  traverseDoc(doc, (child) => {
    if (typeof child === "string") {
      let current = 0;
      for (const char of child) {
        if (char === "-") {
          current++;
          if (current > maxDashes) maxDashes = current;
        } else {
          current = 0;
        }
      }
    }
  });

  const breakDashes = maxDashes > 1 ? "-".repeat(maxDashes + 1) : "--";
  return b.group([
    b.ifBreak(breakDashes, "--"),
    b.line,
    doc,
    b.ifBreak([b.line, breakDashes]),
  ]);
}

function trimText(text: string, path: AstPath<Node.Text>) {
  if (/^(?:\n\s*)?(?:\n\s*)?$/.test(text)) return "";

  const siblings = path.siblings as Node.ChildNode[];
  let trimmed = text;
  let prev: Node.ChildNode | undefined;
  let next: Node.ChildNode | undefined;

  for (let i = path.index!; --i >= 0; ) {
    const sibling = siblings[i];
    if (
      sibling.type !== NodeType.Scriptlet &&
      sibling.type !== NodeType.Comment
    ) {
      prev = sibling;
      break;
    }
  }

  for (let i = path.index!; ++i < siblings.length; ) {
    const sibling = siblings[i];
    if (
      sibling.type !== NodeType.Scriptlet &&
      sibling.type !== NodeType.Comment
    ) {
      next = sibling;
      break;
    }
  }

  const parent = path.node.parent;
  const isInline = !parent.parent || parent.concise ? isTextLike : isInlineHTML;
  const trimStart = !(prev && isInline(prev));
  const trimEnd = !(next && isInline(next));

  if (trimStart) {
    trimmed = trimmed.replace(/^\n\s*/, "");
  }

  if (trimEnd) {
    trimmed = trimmed.replace(/\n\s*$/, "");
  }

  return trimmed.replace(/\s+/g, " ");
}

function isTextLike(node: AnyNode): node is Node.Text | Node.Placeholder {
  switch (node.type) {
    case NodeType.Text:
    case NodeType.Placeholder:
      return true;
    case NodeType.Comment:
      return node.block;
    default:
      return false;
  }
}

function isInlineHTML(
  node: AnyNode,
): node is Node.Text | Node.Placeholder | Node.Comment | Node.Tag {
  switch (node.type) {
    case NodeType.Text:
    case NodeType.Placeholder:
      return true;
    case NodeType.Comment:
      return node.block;
    case NodeType.Tag:
      return (
        !!node.nameText &&
        /^(?:a(?:bbr|cronym)?|b(?:do|ig|r)?|cite|code|dfn|em|i(?:mg)?|kbd|label|map|object|output|q|samp|small|span|strong|sub|sup|time|tt|var)$/.test(
          node.nameText,
        )
      );
    default:
      return false;
  }
}

function hasPreservedText(node: Node.ParentNode) {
  if (node.type === NodeType.Tag && hasTagParser(node)) {
    return true;
  }

  let cur: Node.ParentNode = node;
  while (cur.type === NodeType.Tag) {
    if (cur.nameText && /^(?:textarea|pre)$/.test(cur.nameText)) {
      return true;
    }

    cur = cur.parent;
  }

  return false;
}

function isDefaultAttr(
  node: AnyNode,
): node is Node.AttrNamed & { value: NonNullable<Node.AttrNamed["value"]> } {
  if (
    node.type === NodeType.AttrNamed &&
    node.value &&
    node.name.start === node.name.end
  ) {
    return true;
  }

  return false;
}

function isConcise(opts: Options) {
  return opts.markoSyntax === "concise";
}

const explicitLineReg = /\S?\n\n/y;
function hasExplicitLine(path: AstPath<AnyNode>, opts: Options) {
  explicitLineReg.lastIndex = path.node.end - 1;
  return explicitLineReg.test(opts._markoParsed!.code);
}

function endsWithLine(doc: Doc[]) {
  switch (doc.length && doc[doc.length - 1]) {
    case b.line:
    case b.hardline:
    case b.literalline:
    case b.softline:
    case b.hardlineWithoutBreakParent:
      return true;
    default:
      return false;
  }
}

function pathHas<T extends AnyNode, K extends keyof T>(
  path: AstPath<T>,
  key: K,
): path is AstPath<T & { [Key in K]: NonNullable<T[K]> }> {
  return !!path.node[key];
}

function unexpectedDoc(opts: Options, node: AnyNode) {
  const parsed = opts._markoParsed!;
  const pos = parsed.positionAt(node.start);
  console.warn(
    `Unable to format "${NodeType[node.type]}", please open an issue https://github.com/marko-js/prettier/issues.${
      opts.filepath
        ? `:\n  at ${opts.filepath}:${pos.line + 1}:${pos.character + 1}`
        : ""
    }\n${parsed
      .read(node)
      .replace(/(?:^|\n)(?!\n])/, opts.filepath ? "$&    " : "$&  ")}\n`,
  );
  return undefined;
}
