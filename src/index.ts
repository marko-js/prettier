import { resolve } from "path";
import { createRequire } from "module";
import {
  Doc,
  doc,
  SupportLanguage,
  Parser,
  Printer,
  SupportOptions,
  AstPath,
  ParserOptions,
} from "prettier";
import type * as Compiler from "@marko/compiler";
import type { types, Config } from "@marko/compiler";
import {
  shorthandIdOrClassReg,
  styleReg,
  voidHTMLReg,
  preserveSpaceTagsReg,
  scriptParser,
  expressionParser,
} from "./constants";
import locToPos from "./utils/loc-to-pos";
import isTextLike from "./utils/is-text-like";
import withLineIfNeeded from "./utils/with-line-if-needed";
import withBlockIfNeeded from "./utils/with-block-if-needed";
import {
  withParensIfNeeded,
  withParensIfBreak,
} from "./utils/with-parens-if-needed";
import asLiteralTextContent from "./utils/as-literal-text-content";
import { getOriginalCodeForNode } from "./utils/get-original-code";
import {
  TSTypeParameterDeclaration,
  TSTypeParameterInstantiation,
} from "@marko/compiler/babel-types";
type Node = types.Node;
const defaultFilePath = resolve("index.marko");
const rootRequire = createRequire(defaultFilePath);
const { builders: b, utils } = doc;
const identity = <T>(val: T) => val;
const emptyArr = [] as const;
const embeddedPlaceholderReg = /__EMBEDDED_PLACEHOLDER_(\d+)__/g;

let currentCompiler: typeof Compiler;
let currentConfig: Config;

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

  markoAttrParen: {
    type: "boolean",
    default: (() => {
      // By default we check if the installed parser supported unenclosed whitespace for all attrs.
      try {
        const compilerRequire = createRequire(
          rootRequire.resolve("@marko/compiler"),
        );
        const [major, minor] = (
          compilerRequire("htmljs-parser/package.json") as { version: string }
        ).version
          .split(".")
          .map((v) => parseInt(v, 10));
        return major < 2 || (major === 2 && minor < 11);
      } catch {
        return false;
      }
    })(),
    category: "Marko",
    description:
      "If enabled all attributes with unenclosed whitespace will be wrapped in parens.",
  },
};

export const parsers: Record<string, Parser<Node>> = {
  marko: {
    astFormat: "marko-ast",
    async parse(text, opts) {
      ensureCompiler();

      const { filepath = defaultFilePath } = opts;
      const { compile, types: t } = currentCompiler;
      const { ast } = await compile(`${text}\n`, filepath, currentConfig);

      opts.originalText = text;
      opts.markoLinePositions = [0];
      opts.markoPreservingSpace = false;

      for (let i = 0; i < text.length; i++) {
        if (text[i] === "\n") {
          opts.markoLinePositions.push(i);
        }
      }

      if (opts.markoSyntax === "auto") {
        opts.markoSyntax = "html";

        for (const childNode of ast.program.body) {
          if (t.isMarkoTag(childNode)) {
            if (
              t.isStringLiteral(childNode.name) &&
              childNode.name.value === "style" &&
              styleReg.exec(childNode.rawValue || "style")![0].endsWith("{")
            ) {
              // Ignore style blocks.
              continue;
            }

            if (
              opts.originalText[locToPos(childNode.loc!.start, opts)] !== "<"
            ) {
              opts.markoSyntax = "concise";
            }

            break;
          }
        }
      }

      // Patch issue where source locations for shorthand class/id attributes are messed up.
      t.traverseFast(ast, (node) => {
        if (node.type === "MarkoAttribute") {
          switch (node.name) {
            case "class":
            case "id":
              switch (node.value.type) {
                case "StringLiteral":
                case "ArrayExpression":
                case "TemplateLiteral":
                case "ObjectExpression":
                  node.value.loc = null;
                  break;
              }
              break;
          }
        }
      });

      return ast;
    },
    locStart(node) {
      return (node as any).loc?.start?.index || 0;
    },
    locEnd(node) {
      return (node as any).loc?.end?.index || 0;
    },
  },
};

export const printers: Record<string, Printer<types.Node>> = {
  "marko-ast": {
    print(path, opts, print) {
      const node = path.getNode();
      if (!node) return "";
      const { types: t } = currentCompiler;

      switch (node.type) {
        case "File":
          return path.call(print, "program");
        case "Program": {
          let text = [] as Doc[];
          const lastIndex = node.body.length - 1;
          const bodyDocs = [] as Doc[];

          path.each((child, i) => {
            const childNode = child.getNode()!;
            const isText = isTextLike(childNode, node);

            if (isText) {
              text.push(print(child));
              if (i !== lastIndex) return;
            }

            if (text.length) {
              const textDoc = b.group([
                "--",
                b.line,
                b.fill(text),
                b.ifBreak([b.softline, "--"]),
              ]);

              if (isText) {
                bodyDocs.push(textDoc);
              } else {
                text = [];
                bodyDocs.push(textDoc, b.hardline, print(child));
              }
            } else {
              bodyDocs.push(print(child));
            }
          }, "body");

          return [b.join(b.hardline, bodyDocs), b.hardline];
        }
        case "MarkoDocumentType":
          return `<!${node.value.replace(/\s+/g, " ").trim()}>`;
        case "MarkoDeclaration":
          return asLiteralTextContent(`<?${node.value}?>`);
        case "MarkoComment": {
          const start = node.loc?.start;
          switch (
            start != null &&
            opts.originalText[locToPos(start, opts) + 1]
          ) {
            case "/":
              return [asLiteralTextContent(`//${node.value}`), b.hardline];
            case "*":
              return asLiteralTextContent(`/*${node.value}*/`);
            default:
              return asLiteralTextContent(`<!--${node.value}-->`);
          }
        }
        case "MarkoCDATA":
          return asLiteralTextContent(`<![CDATA[${node.value}]]>`);
        case "MarkoTag": {
          const tagPath = path as AstPath<types.MarkoTag>;
          const groupId = Symbol();
          const doc: Doc[] = [opts.markoSyntax === "html" ? "<" : ""];
          const { markoPreservingSpace } = opts;
          const literalTagName = t.isStringLiteral(node.name)
            ? node.name.value
            : "";
          const preserveSpace =
            markoPreservingSpace ||
            (opts.markoPreservingSpace =
              preserveSpaceTagsReg.test(literalTagName));

          if (literalTagName) {
            doc.push(literalTagName);
          } else {
            doc.push(
              b.group([
                "${",
                b.indent([b.softline, tagPath.call(print, "name")]),
                b.softline,
                "}",
              ]),
            );
          }

          if (node.typeArguments) {
            doc.push(
              (
                tagPath as AstPath<
                  types.MarkoTag & {
                    typeArguments: TSTypeParameterInstantiation;
                  }
                >
              ).call(print, "typeArguments"),
            );
          }
          if (node.body.typeParameters) {
            if (!node.typeArguments) {
              doc.push(" ");
            }
            doc.push(
              (
                tagPath as AstPath<
                  types.MarkoTag & {
                    body: {
                      typeParameters: TSTypeParameterDeclaration;
                    };
                  }
                >
              ).call(print, "body", "typeParameters"),
            );
          }

          const shorthandIndex = doc.push("") - 1;

          if (node.var) {
            doc.push(
              "/",
              (tagPath as AstPath<types.MarkoTag & { var: types.LVal }>).call(
                print,
                "var",
              ),
            );
          }

          if (node.arguments?.length) {
            doc.push(
              b.group([
                "(",
                b.indent([
                  b.softline,
                  b.join(
                    [",", b.line],
                    tagPath.map((it) => print(it), "arguments"),
                  ),
                  opts.trailingComma === "all" &&
                  !preventTrailingCommaTagArgs(literalTagName)
                    ? b.ifBreak(",")
                    : "",
                ]),
                b.softline,
                ")",
              ]),
            );
          }

          if (node.body.params.length) {
            doc.push(
              b.group([
                "|",
                b.indent([
                  b.softline,
                  b.join(
                    [",", b.line],
                    tagPath.map((it) => print(it), "body", "params"),
                  ),
                  opts.trailingComma === "all" ? b.ifBreak(",") : "",
                ]),
                b.softline,
                "|",
              ]),
            );
          }

          if (node.attributes.length) {
            const attrsDoc: Doc[] = [];

            tagPath.each((attrPath) => {
              const attrNode = attrPath.getNode();

              if (
                t.isMarkoAttribute(attrNode) &&
                (attrNode.name === "class" || attrNode.name === "id")
              ) {
                if (
                  opts.markoSyntax === "concise" &&
                  t.isStringLiteral(attrNode.value) &&
                  !attrNode.modifier &&
                  shorthandIdOrClassReg.test(attrNode.value.value)
                ) {
                  const symbol = attrNode.name === "class" ? "." : "#";
                  doc[shorthandIndex] +=
                    symbol + attrNode.value.value.split(/ +/).join(symbol);
                } else {
                  attrsDoc.push(print(attrPath));
                }
              } else if ((attrNode as types.MarkoAttribute).default) {
                doc.push(print(attrPath));
              } else {
                attrsDoc.push(print(attrPath));
              }
            }, "attributes");

            if (attrsDoc.length) {
              if (attrsDoc.length === 1) {
                doc.push(" ", attrsDoc[0]);
              } else {
                doc.push(
                  b.group([
                    opts.markoSyntax === "concise" ? b.ifBreak(" [") : "",
                    b.indent([b.line, b.join(b.line, attrsDoc)]),
                    opts.markoSyntax === "concise"
                      ? b.ifBreak([b.line, "]"])
                      : b.ifBreak(b.line),
                  ]),
                );
              }
            }
          }

          if (voidHTMLReg.test(literalTagName)) {
            if (opts.markoSyntax === "html") doc.push(">");
          } else if (node.body.body.length) {
            const lastIndex = node.body.body.length - 1;
            const bodyDocs = Array.isArray((node as any).attributeTags)
              ? (tagPath as any).map(print, "attributeTags")
              : [];
            let textOnly = true;

            let textDocs = [] as Doc[];
            tagPath.each(
              (childPath, i) => {
                const childNode = childPath.getNode()!;
                const isText = isTextLike(childNode, node);

                if (isText) {
                  textDocs.push(print(childPath));
                  if (i !== lastIndex) return;
                } else {
                  textOnly = false;
                }

                if (textDocs.length) {
                  const isFirst = !bodyDocs.length;
                  bodyDocs.push(
                    b.group([
                      opts.markoSyntax === "html"
                        ? ""
                        : isFirst
                          ? b.ifBreak("--", " --", { groupId })
                          : "--",
                      opts.markoSyntax === "html"
                        ? ""
                        : preserveSpace
                          ? b.hardline
                          : b.line,
                      preserveSpace ? textDocs : b.fill(textDocs),
                      opts.markoSyntax === "html"
                        ? ""
                        : b.ifBreak([b.softline, "--"]),
                    ]),
                  );

                  if (!isText) {
                    textDocs = [];
                    bodyDocs.push(print(childPath));
                  }
                } else {
                  bodyDocs.push(print(childPath));
                }
              },
              "body",
              "body",
            );

            const joinSep =
              (preserveSpace || !textOnly) &&
              (opts.markoSyntax === "concise" ||
                node.body.body.some((child) => child.type === "MarkoScriptlet"))
                ? b.hardline
                : preserveSpace
                  ? ""
                  : b.softline;
            const wrapSep =
              !preserveSpace &&
              opts.markoSyntax === "html" &&
              (node.var ||
                node.body.params.length ||
                node.arguments?.length ||
                node.attributes.length ||
                node.body.body.some((child) => !isTextLike(child, node)))
                ? b.hardline
                : joinSep;

            if (opts.markoSyntax === "html") {
              doc.push(">");
            }

            if (joinSep || wrapSep) {
              doc.push(b.indent([wrapSep, b.join(joinSep, bodyDocs)]));

              if (opts.markoSyntax === "html") {
                doc.push(wrapSep);
              }
            } else {
              doc.push(...bodyDocs);
            }

            if (opts.markoSyntax === "html") {
              doc.push(`</${literalTagName}>`);
            }
          } else if (opts.markoSyntax === "html") {
            doc.push("/>");
          }

          opts.markoPreservingSpace = markoPreservingSpace;
          return withLineIfNeeded(node, opts, b.group(doc, { id: groupId }));
        }
        case "MarkoAttribute": {
          const attrPath = path as AstPath<types.MarkoAttribute>;
          const doc: Doc[] = [];
          const { value } = node;

          if (!node.default) {
            doc.push(node.name);

            if (node.modifier) {
              doc.push(`:${node.modifier}`);
            }

            if (node.arguments?.length) {
              doc.push(
                b.group([
                  "(",
                  b.indent([
                    b.softline,
                    b.join(
                      [",", b.line],
                      attrPath.map((it) => print(it), "arguments"),
                    ),
                    opts.trailingComma === "all" &&
                    !preventTrailingCommaAttrArgs(node.name)
                      ? b.ifBreak(",")
                      : "",
                  ]),
                  b.softline,
                  ")",
                ]),
              );
            }
          }

          if (node.default || !t.isBooleanLiteral(value, { value: true })) {
            if (
              t.isFunctionExpression(value) &&
              !(value.id || value.async || value.generator)
            ) {
              doc.push(attrPath.call(print, "value"));
            } else {
              doc.push(
                node.bound ? ":=" : "=",
                b.group(
                  withParensIfNeeded(
                    value,
                    attrPath.call(print, "value"),
                    opts.markoAttrParen,
                  ),
                ),
              );
            }
          }

          return doc;
        }
        case "MarkoSpreadAttribute": {
          return (["..."] as Doc[]).concat(
            withParensIfNeeded(
              node.value,
              (path as AstPath<types.MarkoSpreadAttribute>).call(
                print,
                "value",
              ),
              opts.markoAttrParen,
            ),
          );
        }
        case "MarkoPlaceholder":
          return [
            node.escape ? "${" : "$!{",
            (path as AstPath<types.MarkoPlaceholder>).call(print, "value"),
            "}",
          ];
        case "MarkoScriptlet": {
          const bodyDocs: Doc = [];
          const prefix = node.static ? "static" : "$";
          path.each((childPath) => {
            const childNode = childPath.getNode() as types.Statement;
            if (childNode && childNode.type !== "EmptyStatement") {
              bodyDocs.push(
                withLineIfNeeded(
                  childNode,
                  opts,
                  printSpecialDeclaration(childPath, prefix, opts, print) || [
                    prefix + " ",
                    withBlockIfNeeded(childNode, childPath.call(print)),
                  ],
                ),
              );
            }
          }, "body");
          return b.join(b.hardline, bodyDocs);
        }
        case "MarkoText": {
          const quote = opts.singleQuote ? "'" : '"';
          const escapedSpace = `\${${quote} ${quote}}`;
          const { value } = node;

          if (
            value === " " &&
            (opts.markoSyntax === "concise" ||
              path.getParentNode()!.type === "Program")
          ) {
            return escapedSpace;
          }

          const breakValue = value.replace(/^ | $/g, escapedSpace);

          if (breakValue === value) {
            return asLiteralTextContent(value);
          }

          return b.ifBreak(
            asLiteralTextContent(breakValue),
            asLiteralTextContent(value),
          );
        }
        default:
          throw new Error(`Unknown node type in Marko template: ${node.type}`);
      }
    },
    embed(path, opts) {
      ensureCompiler();

      const node = path.getNode() as types.Node;
      const type = node?.type;
      const { types: t } = currentCompiler;

      switch (type) {
        case "File":
        case "Program":
          return null;
        case "MarkoClass":
          return (toDoc) =>
            toDoc(
              `class ${getOriginalCodeForNode(
                opts as ParserOptions<types.Node>,
                node.body,
              )}`,
              { parser: expressionParser },
            );
        case "MarkoTag":
          if (node.name.type === "StringLiteral") {
            switch (node.name.value) {
              case "script":
                return async (toDoc, print) => {
                  const placeholders = [] as Doc[];
                  const groupId = Symbol();
                  const doc: Doc[] = [
                    opts.markoSyntax === "html" ? "<" : "",
                    "script",
                  ];
                  let placeholderId = 0;

                  if (node.var) {
                    doc.push(
                      "/",
                      (
                        path as AstPath<types.MarkoTag & { var: types.LVal }>
                      ).call(print, "var"),
                    );
                  }

                  if (node.attributes.length) {
                    const attrsDoc: Doc[] = [];

                    path.each((attrPath) => {
                      const attrNode = attrPath.getNode() as types.Node;
                      if ((attrNode as types.MarkoAttribute).default) {
                        doc.push(print(attrPath));
                      } else {
                        attrsDoc.push(print(attrPath));
                      }
                    }, "attributes");

                    if (attrsDoc.length) {
                      if (attrsDoc.length === 1) {
                        doc.push(" ", attrsDoc[0]);
                      } else {
                        doc.push(
                          b.group([
                            opts.markoSyntax === "concise"
                              ? b.ifBreak(" [")
                              : "",
                            b.indent([b.line, b.join(b.line, attrsDoc)]),
                            opts.markoSyntax === "concise"
                              ? b.ifBreak([b.line, "]"])
                              : b.ifBreak(b.line),
                          ]),
                        );
                      }
                    }
                  }

                  if (node.body.body.length) {
                    const wrapSep =
                      opts.markoSyntax === "html" &&
                      (node.var ||
                        node.body.params.length ||
                        node.arguments?.length ||
                        node.attributes.length ||
                        node.body.body.some(
                          (child) => !isTextLike(child, node),
                        ))
                        ? b.hardline
                        : opts.markoSyntax === "concise" ||
                            node.body.body.some(
                              (child) => child.type === "MarkoScriptlet",
                            )
                          ? b.hardline
                          : b.softline;

                    if (opts.markoSyntax === "html") {
                      doc.push(">");
                    }

                    let embeddedCode = "";
                    path.each(
                      (childPath) => {
                        const childNode = childPath.getNode() as types.Node;
                        if (childNode.type === "MarkoText") {
                          embeddedCode += childNode.value;
                        } else {
                          embeddedCode += `__EMBEDDED_PLACEHOLDER_${placeholderId++}__`;
                          placeholders.push(print(childPath));
                        }
                      },
                      "body",
                      "body",
                    );

                    const bodyDoc = b.group([
                      opts.markoSyntax === "html"
                        ? ""
                        : b.ifBreak("--", " --", { groupId }),
                      opts.markoSyntax === "html" ? "" : b.line,
                      replaceEmbeddedPlaceholders(
                        await toDoc(embeddedCode, {
                          parser: scriptParser,
                        }).catch(() =>
                          asLiteralTextContent(embeddedCode.trim()),
                        ),
                        placeholders,
                      ),
                      opts.markoSyntax === "html"
                        ? ""
                        : b.ifBreak([b.softline, "--"]),
                    ]);

                    doc.push(b.indent([wrapSep, bodyDoc]));

                    if (opts.markoSyntax === "html") {
                      doc.push(wrapSep, `</script>`);
                    }
                  } else if (opts.markoSyntax === "html") {
                    doc.push("/>");
                  }

                  return withLineIfNeeded(
                    node,
                    opts as any,
                    b.group(doc, { id: groupId }),
                  );
                };
              case "style": {
                const rawValue = node.rawValue!;
                const [startContent, lang] = styleReg.exec(
                  rawValue || "style",
                )!;
                const parser = lang ? getParserNameFromExt(lang) : "css";

                if (startContent.endsWith("{")) {
                  // style { block }
                  const codeSartOffset = startContent.length;
                  const codeEndOffset = node.rawValue!.lastIndexOf("}");
                  const code = rawValue
                    .slice(codeSartOffset, codeEndOffset)
                    .trim();

                  return async (toDoc) => {
                    try {
                      return withLineIfNeeded(
                        node,
                        opts as any,
                        b.group([
                          "style",
                          !lang || lang === ".css" ? "" : lang,
                          " {",
                          b.indent([
                            b.line,
                            await toDoc(code, { parser }).catch(() =>
                              asLiteralTextContent(code.trim()),
                            ),
                          ]),
                          b.line,
                          "}",
                        ]),
                      );
                    } catch {
                      return withLineIfNeeded(
                        node,
                        opts as any,
                        asLiteralTextContent(rawValue),
                      );
                    }
                  };
                } else {
                  return async (toDoc, print) => {
                    const placeholders = [] as Doc[];
                    const groupId = Symbol();
                    const doc: Doc[] = [
                      opts.markoSyntax === "html" ? "<" : "",
                      "style",
                      !lang || lang === ".css" ? "" : lang,
                    ];
                    let placeholderId = 0;

                    if (node.var) {
                      doc.push(
                        "/",
                        (
                          path as AstPath<types.MarkoTag & { var: types.LVal }>
                        ).call(print, "var"),
                      );
                    }

                    if (!lang && node.attributes.length) {
                      const attrsDoc: Doc[] = [];

                      path.each((attrPath) => {
                        const attrNode = attrPath.getNode() as types.Node;
                        if ((attrNode as types.MarkoAttribute).default) {
                          doc.push(print(attrPath));
                        } else {
                          attrsDoc.push(print(attrPath));
                        }
                      }, "attributes");

                      if (attrsDoc.length) {
                        if (attrsDoc.length === 1) {
                          doc.push(" ", attrsDoc[0]);
                        } else {
                          doc.push(
                            b.group([
                              opts.markoSyntax === "concise"
                                ? b.ifBreak(" [")
                                : "",
                              b.indent([b.line, b.join(b.line, attrsDoc)]),
                              opts.markoSyntax === "concise"
                                ? b.ifBreak([b.line, "]"])
                                : b.ifBreak(b.line),
                            ]),
                          );
                        }
                      }
                    }

                    if (node.body.body.length) {
                      const wrapSep =
                        opts.markoSyntax === "html" &&
                        (node.var ||
                          node.body.params.length ||
                          node.arguments?.length ||
                          node.attributes.length ||
                          node.body.body.some(
                            (child) => !isTextLike(child, node),
                          ))
                          ? b.hardline
                          : opts.markoSyntax === "concise" ||
                              node.body.body.some(
                                (child) => child.type === "MarkoScriptlet",
                              )
                            ? b.hardline
                            : b.softline;

                      if (opts.markoSyntax === "html") {
                        doc.push(">");
                      }

                      let embeddedCode = "";
                      path.each(
                        (childPath) => {
                          const childNode = childPath.getNode() as types.Node;
                          if (childNode.type === "MarkoText") {
                            embeddedCode += childNode.value;
                          } else {
                            embeddedCode += `__EMBEDDED_PLACEHOLDER_${placeholderId++}__`;
                            placeholders.push(print(childPath));
                          }
                        },
                        "body",
                        "body",
                      );

                      const bodyDoc = b.group([
                        opts.markoSyntax === "html"
                          ? ""
                          : b.ifBreak("--", " --", { groupId }),
                        opts.markoSyntax === "html" ? "" : b.line,
                        replaceEmbeddedPlaceholders(
                          await toDoc(embeddedCode, { parser }).catch(() =>
                            asLiteralTextContent(embeddedCode.trim()),
                          ),
                          placeholders,
                        ),
                        opts.markoSyntax === "html"
                          ? ""
                          : b.ifBreak([b.softline, "--"]),
                      ]);
                      doc.push(b.indent([wrapSep, bodyDoc]));

                      if (opts.markoSyntax === "html") {
                        doc.push(wrapSep, `</style>`);
                      }
                    } else if (opts.markoSyntax === "html") {
                      doc.push("/>");
                    }

                    return withLineIfNeeded(
                      node,
                      opts as any,
                      b.group(doc, { id: groupId }),
                    );
                  };
                }
              }
            }
          }
      }

      if (type.startsWith("Marko")) return null;

      return async (toDoc, print) => {
        switch (node.type) {
          case "EmptyStatement":
            return undefined;
          case "ExportNamedDeclaration":
            if (node.declaration) {
              const printedDeclaration = (
                path as AstPath<
                  typeof node & { declaration: types.Declaration }
                >
              ).call(
                (childPath) =>
                  printSpecialDeclaration(
                    childPath,
                    "export",
                    opts as ParserOptions<Node>,
                    print,
                  ),
                "declaration",
              );
              if (printedDeclaration) return printedDeclaration;
            }
            break;
        }

        const code = getOriginalCodeForNode(
          opts as ParserOptions<types.Node>,
          node,
        );

        if (t.isStatement(node)) {
          return tryPrintEmbed(code, scriptParser);
        } else {
          const parent = path.getParentNode() as types.Node | undefined;
          const parentType = parent?.type;
          if (parentType === "MarkoTag" && path.key === "typeArguments") {
            return tryPrintEmbed(
              `_${code}`,
              scriptParser,
              (doc: any) => {
                return doc[1].contents;
              },
              code,
            );
          } else if (
            parentType === "MarkoTagBody" &&
            path.key === "typeParameters"
          ) {
            return tryPrintEmbed(
              `function _${code}() {}`,
              scriptParser,
              (doc: any) => {
                return doc[1].contents;
              },
              code,
            );
          } else if (
            parentType === "MarkoTagBody" ||
            (parentType === "VariableDeclarator" && path.key === "id") ||
            (parentType === "MarkoTag" && path.key === "var")
          ) {
            return tryPrintEmbed(
              `var ${code}=_`,
              scriptParser,
              (doc: any) => {
                const contents = doc[0].contents[1].contents;
                for (let i = contents.length; i--; ) {
                  const item = contents[i];
                  if (typeof item === "string") {
                    // Walks back until we find the equals sign.
                    const match = /\s*=\s*$/.exec(item);
                    if (match) {
                      contents[i] = item.slice(0, -match[0].length);
                      contents.length = i + 1;
                      break;
                    }
                  }
                }

                return contents;
              },
              code,
            );
          } else if (
            parentType === "MarkoAttribute" &&
            path.key === "value" &&
            node.type === "FunctionExpression" &&
            !(node.async || node.generator || node.id)
          ) {
            return tryPrintEmbed(
              `({_${code.replace(/^\s*function\s*/, "")}})`,
              scriptParser,
              (doc: any) => {
                return doc[1].contents[1].contents[1].contents.slice(1);
              },
              code,
            );
          }

          return tryPrintEmbed(code, expressionParser);
        }

        async function tryPrintEmbed(
          code: string,
          parser: string,
          normalize: (doc: Doc) => Doc = identity,
          fallback: string = code,
        ) {
          try {
            return normalize(await toDoc(code, { parser }));
          } catch {
            return [asLiteralTextContent(fallback)];
          }
        }
      };
    },
    getVisitorKeys(node) {
      ensureCompiler();
      return (currentCompiler.types as any).VISITOR_KEYS[node.type] || emptyArr;
    },
  },
};

export function setCompiler(compiler: typeof Compiler, config: Config) {
  currentCompiler = compiler;
  setConfig(config);
}

function printSpecialDeclaration(
  path: AstPath<Node>,
  prefix: string,
  opts: ParserOptions<Node>,
  print: (path: AstPath<Node>) => doc.builders.Doc,
) {
  const node = path.getNode();
  switch (node?.type) {
    case "TSTypeAliasDeclaration":
      return [
        prefix + " type ",
        node.id.name,
        node.typeParameters
          ? [
              "<",
              b.group([
                b.indent([
                  b.softline,
                  (path as AstPath<typeof node>).call(
                    (paramsPath) =>
                      b.join(
                        [",", b.line],
                        paramsPath.map((param) => param.call(print)),
                      ),
                    "typeParameters",
                    "params",
                  ),
                ]),
                b.softline,
                ">",
              ]),
            ]
          : "",
        " = ",
        withParensIfBreak(
          node.typeAnnotation,
          (path as AstPath<typeof node>).call(print, "typeAnnotation"),
        ),
        opts.semi ? ";" : "",
      ];
    case "VariableDeclaration": {
      return b.join(
        b.hardline,
        (path as AstPath<typeof node>).map((declPath) => {
          const decl = declPath.getNode()!;
          return [
            prefix + " " + (node.declare ? "declare " : "") + node.kind + " ",
            declPath.call(print, "id"),
            decl.init
              ? [
                  " = ",
                  withParensIfBreak(
                    decl.init,
                    (
                      declPath as AstPath<
                        types.VariableDeclarator & {
                          init: types.Expression;
                        }
                      >
                    ).call(print, "init"),
                  ),
                ]
              : "",
            opts.semi ? ";" : "",
          ];
        }, "declarations"),
      );
    }
  }
}

function replaceEmbeddedPlaceholders(doc: Doc, placeholders: Doc[]) {
  if (!placeholders.length) return doc;

  return utils.mapDoc(doc, (cur) => {
    if (typeof cur === "string") {
      let match = embeddedPlaceholderReg.exec(cur);

      if (match) {
        const replacementDocs = [] as Doc[];
        let index = 0;

        do {
          const placeholderIndex = +match[1];

          if (index !== match.index) {
            replacementDocs.push(cur.slice(index, match.index));
          }

          replacementDocs.push(placeholders[placeholderIndex]);
          index = match.index + match[0].length;
        } while ((match = embeddedPlaceholderReg.exec(cur)));

        if (index !== cur.length) {
          replacementDocs.push(cur.slice(index));
        }

        if (replacementDocs.length === 1) {
          return replacementDocs[0];
        }

        return replacementDocs;
      }
    }

    return cur;
  });
}

function getParserNameFromExt(ext: string) {
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
  }
}

function preventTrailingCommaTagArgs(tagName: string) {
  switch (tagName) {
    case "if":
    case "else-if":
    case "while":
      return true;
    default:
      return false;
  }
}

function preventTrailingCommaAttrArgs(attrName: string) {
  switch (attrName) {
    case "if":
    case "while":
    case "no-update-if":
    case "no-update-body-if":
      return true;
    default:
      return false;
  }
}

function ensureCompiler() {
  if (!currentConfig) {
    let config: Config;
    try {
      currentCompiler = rootRequire("@marko/compiler");
      config = rootRequire("@marko/compiler/config").default;
    } catch (cause) {
      throw new Error(
        "You must have @marko/compiler installed to use prettier-plugin-marko.",
        { cause },
      );
    }

    setConfig(config);
  }
}

function setConfig(config: Config) {
  let { translator } = config;
  if (typeof translator === "string") {
    try {
      translator = rootRequire(translator);
    } catch {
      // ignore
    }
  }

  currentConfig = {
    ...config,
    translator,
    ast: true,
    code: false,
    optimize: false,
    output: "source",
    sourceMaps: false,
    writeVersionComment: false,
    babelConfig: {
      caller: { name: "@marko/prettier" },
      babelrc: false,
      configFile: false,
      parserOpts: {
        allowUndeclaredExports: true,
        allowAwaitOutsideFunction: true,
        allowReturnOutsideFunction: true,
        allowImportExportEverywhere: true,
        plugins: ["exportDefaultFrom", "importAssertions"],
      },
    },
  };
}
