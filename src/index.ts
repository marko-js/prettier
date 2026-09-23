import { escapeText } from "htmljs-parser";
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
  util,
} from "prettier";

import {
  CommentType,
  type Node,
  NodeType,
  parse as parseMarko,
  type Parsed,
  type Range,
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
  splitTagVarComment,
  toBlockComment,
  toValidAttrValue,
  toValidExactAttrValue,
  toValidScriptlet,
  toValidStatement,
} from "./utils/to-valid-doc";
import {
  ensureVisibleSpace,
  ensureVisibleSpaceBetweenTags,
  ensureVisibleTrailingSpace,
  getVisibleSpace,
  isVisibleSpace,
} from "./utils/visible-space";

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
type ToDocFn = (text: string, options: Options) => Promise<Doc>;
type PrintFn = (path: AstPath<AnyNode>) => Doc;

type EmbedHandler<T extends AnyNode> = (
  toDoc: ToDocFn,
  print: (
    selector?: string | number | Array<string | number> | AstPath<AnyNode>,
  ) => Doc,
  path: AstPath<T>,
  options: Options,
) => Promise<Doc | undefined> | Doc | undefined;
type EmbedHandlers = {
  [K in NodeType]?: EmbedHandler<AnyNode & { type: K }>;
};

type PrintHandler<T extends AnyNode> = (
  path: AstPath<T>,
  opts: ParserOptions<AnyNode>,
  print: PrintFn,
) => Doc;
type PrintHandlers = {
  [K in NodeType]?: PrintHandler<AnyNode & { type: K }>;
};

type Body = ReturnType<typeof printBody>;

const b = doc.builders;
const traverseDoc = doc.utils.traverseDoc;
const findInDoc = doc.utils.findInDoc;
const mapDoc = doc.utils.mapDoc;
const hasNewline = util.hasNewline;
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
  [NodeType.Program]: ["body"] as const satisfies (keyof Node.Program)[],
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
    /* c8 ignore start */
    locStart(node) {
      return node.start;
    },
    locEnd(node) {
      return node.end;
    },
    /* c8 ignore end */
  },
};

export const printers: Record<string, Printer<AnyNode>> = {
  "marko-ast": {
    print(path, opts, print) {
      const { type } = path.node;
      const handler = printHandlers[type] as PrintHandler<AnyNode>;
      if (handler) return handler(path, opts, print);
      /* c8 ignore next */
      throw new Error(
        `Unknown node type in Marko template: ${NodeType[type] || type}`,
      );
    },
    embed(path) {
      return embedHandlers[path.node.type as NodeType] ?? null;
    },
    getVisitorKeys(node) {
      return (
        visitorKeys[node.type as keyof typeof visitorKeys] || noVisitorKeys
      );
    },
  },
};

const printHandlers: PrintHandlers = {
  [NodeType.AttrArgs]: printExact,
  [NodeType.AttrMethod]: printExact,
  // The attr handlers are reached when the embed fails, eg no JS parser is
  // loaded, and print from source.
  [NodeType.AttrNamed]: (path, opts) => {
    const { node } = path;
    const { value } = node;
    if (value?.type === NodeType.AttrValue) {
      return [
        read({ start: node.start, end: value.value.start }, opts),
        toValidExactAttrValue(read(value.value, opts), isConcise(opts)),
      ];
    }

    if (value?.type === NodeType.AttrMethod && value.async) {
      // The keyword is printed rather than copied, since the whitespace after
      // it may be a newline, which would end a concise attr.
      const isDefault = isDefaultAttr(node);
      const { start } = isDefault
        ? (value.typeParams ?? value.params)
        : node.name;
      return [
        isDefault ? " async " : "async ",
        read({ start, end: node.end }, opts),
      ];
    }

    return read(node, opts);
  },
  [NodeType.AttrSpread]: (path, opts) => [
    "...",
    toValidExactAttrValue(read(path.node.value, opts), isConcise(opts)),
  ],
  [NodeType.Class]: printExact,
  [NodeType.Export]: printExact,
  [NodeType.Import]: printExact,
  [NodeType.OpenTagName]: printExact,
  [NodeType.Placeholder]: printExact,
  [NodeType.Scriptlet]: printExact,
  [NodeType.ShorthandClassName]: printExact,
  [NodeType.ShorthandId]: printExact,
  [NodeType.Static]: printExact,
  [NodeType.Style]: printExact,
  [NodeType.TagArgs]: printExact,
  [NodeType.TagParams]: printExact,
  [NodeType.TagTypeArgs]: printExact,
  [NodeType.TagTypeParams]: printExact,
  [NodeType.TagVar]: (path, opts) => {
    const value = read(path.node.value, opts);
    const [code, comment] = splitTagVarComment(value);
    return code === value ? read(path.node, opts) : ["/", code, comment];
  },
  [NodeType.Tag]: printTag,
  [NodeType.AttrTag]: printTag,
  [NodeType.CDATA]: (path, opts) =>
    `<![CDATA[${read(path.node.value, opts)}]]>`,
  [NodeType.Comment]: (path, opts) => {
    const code = read(path.node, opts);
    return path.node.commentType === CommentType.line
      ? b.lineSuffix(code)
      : printCommentLines(code);
  },
  [NodeType.Doctype]: (path, opts) =>
    `<!${read(path.node.value, opts).replace(/\s+/g, " ").trim()}>`,
  [NodeType.Declaration]: (path, opts) =>
    `<?${read(path.node.value, opts).trim()}?>`,
  [NodeType.Program]: (path, opts, print) => {
    const body = printBody(path, opts, print);
    if (!body) return [b.hardline];

    return [
      body.inline
        ? wrapConciseText(body.content)
        : b.join(b.hardline, body.content),
      b.hardline,
    ];
  },
  [NodeType.Text]: (path, opts) =>
    escapeText(read(path.node, opts), readNextContent(path, opts)),
};

const embedHandlers: EmbedHandlers = {
  [NodeType.Class]: (toDoc, _print, path, opts) =>
    toDoc(read(path.node, opts), exprParse),

  [NodeType.Import]: (toDoc, _print, path, opts) =>
    toDoc(read(path.node, opts), stmtParse),

  [NodeType.Export]: (toDoc, _print, path, opts) =>
    toDoc(read(path.node, opts), stmtParse),

  [NodeType.Style]: async (toDoc, _print, path, opts) => {
    const { node } = path;
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
  },

  [NodeType.Static]: async (toDoc, _print, path, opts) => {
    const { node } = path;
    const code = opts
      ._markoParsed!.code.slice(node.start + node.target.length + 1, node.end)
      .replace(/^\s*\{([\s\S]*)\}\s*$/, "$1")
      .trim();
    return code
      ? [`${node.target} `, toValidStatement(await toDoc(code, stmtParse))]
      : [];
  },

  [NodeType.Scriptlet]: async (toDoc, _print, path, opts) => {
    const code = read(path.node.value, opts)
      .replace(/^\s*\{([\s\S]*)\}\s*$/, "$1")
      .trim();
    return code
      ? [b.breakParent, "$ ", toValidScriptlet(await toDoc(code, stmtParse))]
      : [];
  },

  [NodeType.OpenTagName]: (toDoc, _print, path, opts) =>
    templateToDoc(toDoc, path, opts),

  [NodeType.Placeholder]: async (toDoc, _print, path, opts) => {
    const { node } = path;
    if (isVisibleSpacePlaceholder(node, opts)) {
      return getVisibleSpace(opts);
    }

    const code = read(node.value, opts);
    return b.group([
      node.escape ? "${" : "$!{",
      b.indent([b.softline, await toDoc(code, exprParse)]),
      b.softline,
      "}",
    ]);
  },

  [NodeType.TagArgs]: (toDoc, _print, path, opts) =>
    argsToDoc(path.node, opts, toDoc),

  [NodeType.AttrNamed]: async (toDoc, _print, path, opts) => {
    const { node } = path;
    const name = read(node.name, opts);
    if (!(node.args || node.value)) return name;
    // A default attribute method is printed flush against the tag name, so an
    // `async` before it has to bring its own leading space.
    const attrDoc: Doc[] =
      node.value?.type === NodeType.AttrMethod && node.value.async
        ? [isDefaultAttr(node) ? " async " : "async ", name]
        : [name];

    if (node.args && !isEmpty(node.args.value, opts)) {
      const argsDoc = await argsToDoc(node.args, opts, toDoc);
      if (argsDoc) {
        attrDoc.push(argsDoc);
        /* c8 ignore start */
      } else {
        return unexpectedDoc(opts, node);
      }
      /* c8 ignore stop */
    }

    if (node.value) {
      if (node.value.type === NodeType.AttrMethod) {
        // Rebuilt from the type params since the keyword prints before the
        // name, but kept here or an `await` in the body fails to parse.
        const { async, typeParams, params, end } = node.value;
        const source = read({ start: (typeParams ?? params).start, end }, opts);
        const attrMethodDoc = await toDoc(
          `${async ? "async " : ""}function${source}`,
          exprParse,
        );

        if (
          Array.isArray(attrMethodDoc) &&
          attrMethodDoc.length &&
          typeof attrMethodDoc[0] === "string"
        ) {
          attrMethodDoc[0] = attrMethodDoc[0].replace(
            /^(?:async\s+)?function\s*/,
            "",
          );
          attrDoc.push(attrMethodDoc);
          /* c8 ignore start */
        } else {
          return unexpectedDoc(opts, node);
        }
        /* c8 ignore stop */
      } else {
        attrDoc.push(
          node.value.bound ? ":=" : "=",
          toValidAttrValue(
            await toDoc(read(node.value.value, opts), exprParse),
            isConcise(opts),
          ),
        );
      }
    }
    return b.group(attrDoc);
  },

  [NodeType.AttrSpread]: async (toDoc, _print, path, opts) => {
    return b.group([
      "...",
      toValidAttrValue(
        await toDoc(read(path.node.value, opts), exprParse),
        isConcise(opts),
      ),
    ]);
  },

  [NodeType.ShorthandId]: async (toDoc, _print, path, opts) => [
    "#",
    await templateToDoc(toDoc, path, opts),
  ],

  [NodeType.ShorthandClassName]: async (toDoc, _print, path, opts) => [
    ".",
    await templateToDoc(toDoc, path, opts),
  ],

  [NodeType.Tag]: async (toDoc, print, path, opts) => {
    const parser = getTagParser(path.node, opts);
    if (parser === undefined) return undefined;
    return printTag(path, opts as ParserOptions<Node.AnyNode>, print, {
      inline: true,
      preserve: parser === false,
      content: await getFormattedBody(path, parser, toDoc, print, opts),
    });
  },

  [NodeType.TagVar]: async (toDoc, _print, path, opts) => {
    const { node } = path;
    const [code, comment] = splitTagVarComment(read(node.value, opts).trim());
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
        for (let i = varContents.length; i--;) {
          const item = varContents[i];
          if (typeof item === "string") {
            // Walks back until we find the equals sign.
            const match = /\s*=\s*$/.exec(item);
            if (match) {
              varContents[i] = item.slice(0, -match[0].length);
              varContents.length = i + 1;
              return ["/", varContents, comment];
            }
          }
        }
        /* c8 ignore start */
      }
    }

    return unexpectedDoc(opts, node);
    /* c8 ignore stop */
  },

  [NodeType.TagTypeArgs]: async (toDoc, _print, path, opts) => {
    const { node } = path;
    if (isEmpty(node.value, opts)) return "";

    const code = read(node.value, opts).trim();
    const doc = await toDoc(`_<${code}>`, exprParse);
    if (typeof doc === "string") {
      return doc.replace(/^_/, "");
    }

    if (Array.isArray(doc) && typeof doc[0] === "string") {
      doc[0] = doc[0].replace(/^_/, "");
      return doc;
    }

    /* c8 ignore next */
    return unexpectedDoc(opts, node);
  },

  [NodeType.TagParams]: async (toDoc, _print, path, opts) => {
    const { node } = path;
    if (isEmpty(node.value, opts)) return "";

    const code = read(node.value, opts).trim();
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
        let paramsContents = [...paramsGroup.contents];
        const first = paramsContents[0];
        const last = paramsContents[paramsContents.length - 1];
        if (typeof first === "string" && typeof last === "string") {
          paramsContents[0] = first.replace(/^\(/, "|");
          paramsContents[paramsContents.length - 1] = last.replace(/\)$/, "|");
        }
        if (docContainsPipe(paramsContents.slice(1, -1))) {
          paramsContents = wrapPipedTypesInParens(paramsContents) as Doc[];
        }

        return b.group(paramsContents);
      }
    }

    /* c8 ignore next */
    return unexpectedDoc(opts, node);
  },

  [NodeType.TagTypeParams]: async (toDoc, _print, path, opts) => {
    const { node } = path;
    if (isEmpty(node.parent.params?.value, opts) || isEmpty(node.value, opts)) {
      return "";
    }

    const code = read(node.value, opts).trim();
    const doc = await toDoc(`function _<${code}>(){}`, stmtParse);
    if (Array.isArray(doc) && doc.length > 1) {
      return doc[1];
    }

    /* c8 ignore next */
    return unexpectedDoc(opts, node);
  },
};

function printTag(
  path: AstPath<Node.Tag | Node.AttrTag>,
  opts: ParserOptions<AnyNode>,
  print: PrintFn,
  body: Body = printBody(path, opts, print),
) {
  return (isConcise(opts) ? printConciseTag : printHTMLTag)(
    path,
    opts,
    print,
    body,
  );
}

function printHTMLTag(
  path: AstPath<Node.Tag | Node.AttrTag>,
  opts: ParserOptions<AnyNode>,
  print: PrintFn,
  body: Body,
) {
  const { node } = path;
  const openTagDoc: Doc[] = [
    "<",
    printOpenTag(path, opts, print).doc,
    body || node.bodyType === TagType.void ? ">" : "/>",
  ];

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
}

function printConciseTag(
  path: AstPath<Node.Tag | Node.AttrTag>,
  opts: ParserOptions<AnyNode>,
  print: PrintFn,
  body: Body,
) {
  const openTag = printOpenTag(path, opts, print);
  const tagDoc: Doc[] = [openTag.doc];

  if (body) {
    tagDoc.push(
      b.group(
        body.inline
          ? body.preserve || openTag.endsWithLineComment
            ? b.indent([
                openTag.endsWithLineComment ? b.hardline : b.line,
                wrapConciseText(body.content),
              ])
            : [" --", b.indent([b.line, body.content])]
          : b.indent([b.hardline, b.join(b.hardline, body.content)]),
      ),
    );
  }

  return b.group(tagDoc);
}

/**
 * Prints the open tag without its delimiters, keeping each comment in place:
 * after the part on its line, else on its own line, unless it ends a concise
 * open tag, where a line of its own would start the body instead.
 */
function printOpenTag(
  path: AstPath<Node.Tag | Node.AttrTag>,
  opts: Options,
  print: PrintFn,
) {
  const { node } = path;
  const concise = isConcise(opts);
  const comments = node.comments ?? [];
  const hasDefault = !!node.attrs && isDefaultAttr(node.attrs[0]);
  const headLine: OpenTagLine = {
    doc: "",
    value:
      hasDefault ||
      (!!node.var && (!node.params || isEmpty(node.params.value, opts))),
    comments: [],
  };
  const lines: OpenTagLine[] = [];
  let nextComment = 0;
  const takeComments = (end: number) => {
    const start = nextComment;
    while (nextComment < comments.length && comments[nextComment].start < end) {
      nextComment++;
    }
    return comments.slice(start, nextComment);
  };
  const addComments = (end: number) => {
    for (const comment of takeComments(end)) {
      if (
        hasNewline(opts._markoParsed!.code, comment.start, { backwards: true })
      ) {
        lines.push({ comments: [comment] });
      } else {
        (lines.at(-1) ?? headLine).comments.push(comment);
      }
    }
  };
  const printLine = (
    { doc, value, comments }: OpenTagLine,
    next: OpenTagLine | undefined,
  ) => {
    const docs = comments.map((comment, i) =>
      printOpenTagComment(comment, opts, i === comments.length - 1),
    );
    if (doc === undefined) return b.join(" ", docs);
    // A comment after a value would be read as part of it, which in concise
    // mode a newline prevents.
    const comma =
      value && (docs.length || (!concise && next && next.doc === undefined));
    return [doc, comma ? "," : "", docs.map((commentDoc) => [" ", commentDoc])];
  };
  const doc: Doc[] = [
    printOpenTagHead(path, opts, print, (part, glued) => {
      const docs = takeComments(part.start).map((comment) =>
        printOpenTagComment(comment, opts, false),
      );
      return docs.length ? [" ", b.join(" ", docs), glued ? "" : " "] : "";
    }),
  ];

  if (pathHas(path, "attrs")) {
    path.each((attrPath, i) => {
      if (hasDefault && i === 0) return;
      const attr = attrPath.node;
      addComments(attr.start);
      lines.push({
        doc: print(attrPath),
        value:
          attr.type === NodeType.AttrSpread ||
          attr.value?.type === NodeType.AttrValue,
        comments: [],
      });
    }, "attrs");
  }

  addComments(Infinity);

  if (concise) {
    const lastAttr = lines.findLastIndex((line) => line.doc !== undefined);
    const lastLine = lines[lastAttr] ?? headLine;
    for (const line of lines.splice(lastAttr + 1)) {
      lastLine.comments.push(...line.comments);
    }
  }

  if (
    lines.length === 1 &&
    !(hasDefault || node.params || node.args || node.comments)
  ) {
    doc.push(" ", lines[0].doc!);
  } else if (lines.length || headLine.comments.length) {
    const attrsDoc = b.indent([
      printLine(headLine, lines[0]),
      lines.map((line, i) => [
        concise && line.doc !== undefined ? [b.line, b.ifBreak(",")] : b.line,
        printLine(line, lines[i + 1]),
      ]),
    ]);
    doc.push(concise ? b.group(attrsDoc) : [attrsDoc, b.softline]);
  }

  return {
    doc,
    endsWithLineComment:
      (lines.at(-1) ?? headLine).comments.at(-1)?.commentType ===
      CommentType.line,
  };
}

/** A line of the open tag, and the comments after its attr or head if any. */
interface OpenTagLine {
  doc?: Doc;
  /** Whether the doc ends in a value, which reads a comment after it. */
  value?: boolean;
  comments: Node.Comment[];
}

/** Prints the parts of the open tag before its attrs, which have no spaces. */
function printOpenTagHead(
  path: AstPath<Node.Tag | Node.AttrTag>,
  opts: Options,
  print: PrintFn,
  printCommentsBefore: (part: Range, glued?: boolean) => Doc,
) {
  const { node } = path;
  const doc: Doc[] = [path.call(print, "name")];

  if (pathHas(path, "typeArgs") && !isEmpty(path.node.typeArgs.value, opts)) {
    doc.push(path.call(print, "typeArgs"));
  }

  if (pathHas(path, "shorthandId")) {
    doc.push(path.call(print, "shorthandId"));
  }

  if (pathHas(path, "shorthandClassNames")) {
    doc.push(path.map(print, "shorthandClassNames"));
  }

  if (pathHas(path, "args") && !isEmpty(path.node.args.value, opts)) {
    doc.push(printCommentsBefore(path.node.args), path.call(print, "args"));
  }

  if (pathHas(path, "var")) {
    doc.push(printCommentsBefore(path.node.var), path.call(print, "var"));
  }

  if (pathHas(path, "params") && !isEmpty(path.node.params.value, opts)) {
    if (
      pathHas(path, "typeParams") &&
      !isEmpty(path.node.typeParams.value, opts)
    ) {
      doc.push(
        printCommentsBefore(path.node.typeParams) ||
          (node.typeArgs || node.args || node.var ? "" : " "),
        path.call(print, "typeParams"),
      );
    } else {
      doc.push(printCommentsBefore(path.node.params));
    }
    doc.push(path.call(print, "params"));
  }

  if (node.attrs && isDefaultAttr(node.attrs[0])) {
    // Glued to the `=`, like the comments that end a tag var, which these join
    // when one comes before them.
    doc.push(
      printCommentsBefore(node.attrs[0], true),
      path.call(print, "attrs", 0),
    );
  }

  return doc;
}

function printBody(
  path: AstPath<Node.ParentNode>,
  opts: Options,
  print: PrintFn,
) {
  const { node } = path;
  if (!node.body) return;

  const concise = !node.parent || isConcise(opts);
  const isInline = concise ? isTextLike : isInlineHTML;
  const preserve = hasPreservedText(node);
  let content: Doc[] | undefined;
  let inline: doc.builders.Fill["parts"] | undefined;
  let inlineIndex = -1;

  if (preserve) {
    let inlineChild = false;
    path.each((child) => {
      const childDoc = child.call(print);
      inlineChild =
        isInline(child.node) ||
        (inlineChild &&
          child.node.type === NodeType.Comment &&
          child.node.commentType !== CommentType.line);
      content ||= [];

      if (inlineChild) {
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
    let inlineChild = false;
    let isInlineTag = false;
    let isExplicitLine = false;
    path.each((child) => {
      const wasInlineTag = isInlineTag;
      let childDoc = child.call(print);
      if (child.node.type === NodeType.Text && typeof childDoc === "string") {
        childDoc = trimText(childDoc, child as AstPath<Node.Text>, opts);
      }

      if (!childDoc) return;

      content ||= [];
      isInlineTag = false;
      inlineChild =
        isInline(child.node) ||
        (inlineChild &&
          child.node.type === NodeType.Comment &&
          child.node.commentType !== CommentType.line);

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
              if (endsWithLine(inline)) return;
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
}

function printExact(path: AstPath<AnyNode>, opts: ParserOptions<AnyNode>) {
  return read(path.node, opts);
}

async function templateToDoc(
  toDoc: ToDocFn,
  path: AstPath<Node.ShorthandId | Node.ShorthandClassName | Node.OpenTagName>,
  opts: Options,
) {
  const { expressions, quasis } = path.node;
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
}

async function argsToDoc(
  node: Node.TagArgs | Node.AttrArgs,
  opts: Options,
  toDoc: ToDocFn,
) {
  if (isEmpty(node.value, opts)) return "";

  const code = read(node.value, opts).trim();
  const doc = await toDoc(`_(${code})`, exprParse);
  if (Array.isArray(doc) && doc.length && typeof doc[0] === "string") {
    doc[0] = doc[0].replace(/^_/, "");
    return doc;
  }

  /* c8 ignore next */
  return unexpectedDoc(opts, node);
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

function trimText(text: string, path: AstPath<Node.Text>, opts: Options) {
  const siblings = path.siblings as Node.ChildNode[];
  const index = path.index!;
  if (rendersNothing(siblings, index, opts)) return "";

  const prev = findRenderedSibling(siblings, index, -1, opts);
  const next = findRenderedSibling(siblings, index, 1, opts);
  const parent = path.node.parent;
  const isInline = (node: Node.ChildNode) => {
    // Concise output puts a tag on its own line, which is not whitespace, so
    // whitespace the compiler renders beside a tag has to be kept.
    if (isConcise(opts) && node.type === NodeType.Tag) return true;
    // A concise parent can still hold HTML tags, from a `---` block, and the
    // whitespace beside an inline one renders.
    return (!parent.parent || parent.concise) &&
      !(node.type === NodeType.Tag && !node.concise)
      ? isTextLike(node)
      : isInlineHTML(node);
  };
  let trimmed = text;

  if (!(prev && isInline(prev))) {
    trimmed = trimmed.replace(/^\n\s*/, "");
  }

  if (!(next && isInline(next))) {
    trimmed = trimmed.replace(/\n\s*$/, "");
  }

  return trimmed.replace(/\s+/g, " ");
}

function readNextContent(path: AstPath<Node.Text>, opts: Options) {
  const next = path.next as AnyNode | null;
  switch (next?.type) {
    case NodeType.Placeholder:
      // Outside preserved text a visible space prints as a line, and
      // ensureVisibleSpace escapes before it where it stays a placeholder.
      return isVisibleSpacePlaceholder(next, opts) &&
        !hasPreservedText(path.node.parent)
        ? ""
        : read(next, opts);
    case NodeType.Text:
      return read(next, opts);
    default:
      return "";
  }
}

function isVisibleSpacePlaceholder(node: Node.Placeholder, opts: Options) {
  const code = read(node.value, opts);
  return code === '" "' || code === "' '";
}

function findRenderedSibling(
  siblings: Node.ChildNode[],
  index: number,
  step: 1 | -1,
  opts: Options,
) {
  for (let i = index + step; i >= 0 && i < siblings.length; i += step) {
    const sibling = siblings[i];
    if (
      sibling.type !== NodeType.Scriptlet &&
      sibling.type !== NodeType.Comment &&
      !rendersNothing(siblings, i, opts)
    ) {
      return sibling;
    }
  }
}

// Mirrors @marko/compiler, which drops a text that is only line breaks, or only
// whitespace after a text that already ends in whitespace.
function rendersNothing(
  siblings: Node.ChildNode[],
  index: number,
  opts: Options,
): boolean {
  const node = siblings[index];
  if (node.type !== NodeType.Text) return false;

  const text = read(node, opts);
  if (/^(?:\n\s*)?(?:\n\s*)?$/.test(text)) return true;
  if (/\S/.test(text)) return false;

  const prev = findRenderedSibling(siblings, index, -1, opts);
  return prev?.type === NodeType.Text && /\s$/.test(read(prev, opts));
}

function isTextLike(node: AnyNode): node is Node.Text | Node.Placeholder {
  switch (node.type) {
    case NodeType.Text:
    case NodeType.Placeholder:
      return true;
    default:
      return false;
  }
}

function isInlineHTML(
  node: AnyNode,
): node is Node.Text | Node.Placeholder | Node.Tag {
  switch (node.type) {
    case NodeType.Text:
    case NodeType.Placeholder:
      return true;
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

function printOpenTagComment(
  comment: Node.Comment,
  opts: Options,
  endsLine: boolean,
): Doc {
  if (comment.commentType !== CommentType.line) {
    return printCommentLines(read(comment, opts));
  }

  return endsLine
    ? [read(comment, opts), b.breakParent]
    : toBlockComment(read(comment.value, opts));
}

/** Prints a comment with its lines indented as they were relative to each other. */
function printCommentLines(code: string): Doc {
  if (!code.includes("\n")) return code;

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

const nonWhitespaceReg = /\S/g;
function isEmpty(range: Range | undefined, opts: Options) {
  if (!range || range.start === range.end) return true;
  nonWhitespaceReg.lastIndex = range.start;
  return !(
    nonWhitespaceReg.test(opts._markoParsed!.code) &&
    nonWhitespaceReg.lastIndex <= range.end
  );
}

function pathHas<T extends AnyNode, K extends keyof T>(
  path: AstPath<T>,
  key: K,
): path is AstPath<T & { [Key in K]: NonNullable<T[K]> }> {
  return !!path.node[key];
}

function docContainsPipe(doc: Doc): boolean {
  return !!findInDoc(
    doc,
    (child: Doc) => {
      if (typeof child === "string" && child.includes("|")) return true;
    },
    false,
  );
}

function wrapPipedTypesInParens(doc: Doc): Doc {
  return mapDoc(doc, (node: Doc) => {
    if (Array.isArray(node)) {
      let changed = false;
      const result = [...node];
      for (let i = 1; i < result.length; i++) {
        const prev = result[i - 1];
        const cur = result[i];
        if (typeof cur === "string" || !docContainsPipe(cur)) continue;
        if (
          // Match "name: " as a single merged string before the type
          (typeof prev === "string" && prev.endsWith(": ")) ||
          // Match ":" " " as separate strings before the type
          (i >= 2 && result[i - 2] === ":" && prev === " ")
        ) {
          result[i] = b.group(["(", cur, b.softline, ")"]);
          changed = true;
        }
      }
      return changed ? result : node;
    }
    return node;
  });
}

/* c8 ignore start */
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
/* c8 ignore stop */
