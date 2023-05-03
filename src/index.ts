import { resolve } from "path";
import { createRequire } from "module";
import {
  Doc,
  doc,
  SupportLanguage,
  Parser,
  Printer,
  getFileInfo,
  SupportOptions,
  AstPath,
  CustomParser,
} from "prettier";
import { compileSync, types as t } from "@marko/compiler";
import {
  Node,
  shorthandIdOrClassReg,
  styleReg,
  voidHTMLReg,
  enclosedNodeTypeReg,
  preserveSpaceTagsReg,
} from "./constants";
import locToPos from "./utils/loc-to-pos";
import callEmbed from "./utils/call-embed";
import isTextLike from "./utils/is-text-like";
import withLineIfNeeded from "./utils/with-line-if-needed";
import withBlockIfNeeded from "./utils/with-block-if-needed";
import withParensIfNeeded from "./utils/with-parens-if-needed";
import asLiteralTextContent from "./utils/as-literal-text-content";
import {
  getOriginalCodeForNode,
  getOriginalCodeForList,
} from "./utils/get-original-code";

const defaultFilePath = resolve("index.marko");
const { builders: b, utils } = doc;
const identity = <T>(val: T) => val;
const embeddedPlaceholderReg = /__EMBEDDED_PLACEHOLDER_(\d+)__/g;
const expressionParser: CustomParser = (code, parsers, options) => {
  const ast = parsers["babel-ts"](`(${code});`, options);
  return { ...ast, program: ast.program.body[0].expression };
};

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
    since: "",
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
    since: "",
    type: "boolean",
    default: (() => {
      // By default we check if the installed parser supported unenclosed whitespace for all attrs.
      try {
        const rootRequire = createRequire(defaultFilePath);
        let compilerRequire: NodeRequire;

        try {
          compilerRequire = createRequire(
            rootRequire.resolve("@marko/compiler")
          );
        } catch {
          compilerRequire = createRequire(rootRequire.resolve("marko"));
        }

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
    parse(text, _parsers, opts) {
      const { filepath = defaultFilePath } = opts;
      const { ast } = compileSync(`${text}\n`, filepath, {
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
      });

      opts.originalText = text;
      opts.markoLinePositions = [0];
      opts.markoScriptParser = "babel-ts";
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

      return ast;
    },
    locStart() {
      return 0;
    },
    locEnd() {
      return 0;
    },
  },
};

export const printers: Record<string, Printer<Node>> = {
  "marko-ast": {
    print(path, opts, print) {
      const node = path.getValue();

      switch (node.type) {
        case "File":
          return path.call(print, "program");
        case "Program": {
          let text = [] as Doc[];
          const lastIndex = node.body.length - 1;
          const bodyDocs = [] as Doc[];

          path.each((child, i) => {
            const childNode = child.getValue();
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
          const tagPath = path as AstPath<t.MarkoTag>;
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
          let embedMode: string | undefined;

          if (literalTagName) {
            if (literalTagName === "script") {
              embedMode = "script";
            } else if (literalTagName === "style") {
              const [startContent, lang = ".css"] = styleReg.exec(
                node.rawValue || literalTagName
              )!;

              embedMode = `style.${
                getFileInfo.sync(opts.filepath + lang).inferredParser
              }`;

              if (startContent.endsWith("{")) {
                // style { block }
                const codeSartOffset = startContent.length;
                const codeEndOffset = node.rawValue!.lastIndexOf("}");
                const code = node.rawValue!.slice(
                  codeSartOffset,
                  codeEndOffset
                );

                return b.group([
                  "style",
                  lang === ".css" ? "" : lang,
                  " {",
                  b.indent([
                    b.line,
                    callEmbed(print, tagPath, embedMode, code),
                  ]),
                  b.line,
                  "}",
                ]);
              }
            }
            doc.push(literalTagName);
          } else {
            doc.push(
              b.group([
                "${",
                b.indent([b.softline, tagPath.call(print, "name")]),
                b.softline,
                "}",
              ])
            );
          }

          const shorthandIndex = doc.push("") - 1;

          if (node.var) {
            doc.push(
              "/",
              callEmbed(
                print,
                tagPath,
                "var",
                getOriginalCodeForNode(opts, node.var)
              )
            );
          }

          if (node.arguments?.length) {
            doc.push(
              b.group([
                "(",
                b.indent([
                  b.softline,
                  b.join([",", b.line], tagPath.map(print, "arguments")),
                  opts.trailingComma ? b.ifBreak(",") : "",
                ]),
                b.softline,
                ")",
              ])
            );
          }

          if (node.body.params.length) {
            doc.push(
              b.group([
                "|",
                callEmbed(
                  print,
                  tagPath,
                  "params",
                  getOriginalCodeForList(opts, ",", node.body.params)
                ),
                "|",
              ])
            );
          }

          if (node.attributes.length) {
            const attrsDoc: Doc[] = [];

            tagPath.each((childPath) => {
              const childNode = childPath.getValue();

              if (
                t.isMarkoAttribute(childNode) &&
                (childNode.name === "class" || childNode.name === "id")
              ) {
                if (
                  (literalTagName === "style" ||
                    opts.markoSyntax === "concise") &&
                  t.isStringLiteral(childNode.value) &&
                  !childNode.modifier &&
                  shorthandIdOrClassReg.test(childNode.value.value)
                ) {
                  const symbol = childNode.name === "class" ? "." : "#";
                  doc[shorthandIndex] +=
                    symbol + childNode.value.value.split(/ +/).join(symbol);
                } else {
                  // Fix issue where class/id shorthands don't have the correct source location when merged.
                  childNode.value.loc = null;
                  attrsDoc.push(print(childPath));
                }
              } else if ((childNode as t.MarkoAttribute).default) {
                doc.push(print(childPath));
              } else {
                attrsDoc.push(print(childPath));
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
                  ])
                );
              }
            }
          }

          if (voidHTMLReg.test(literalTagName)) {
            if (opts.markoSyntax === "html") doc.push(">");
          } else if (node.body.body.length) {
            const lastIndex = node.body.body.length - 1;
            const bodyDocs = [] as Doc[];
            let textOnly = true;

            if (embedMode) {
              let placeholderId = 0;
              const placeholders = [] as Doc[];
              let embeddedCode = "";

              tagPath.each(
                (child) => {
                  const node = child.getValue();
                  if (node.type === "MarkoText") {
                    embeddedCode += node.value;
                  } else {
                    embeddedCode += `__EMBEDDED_PLACEHOLDER_${placeholderId++}__`;
                    placeholders.push(print(child));
                  }
                },
                "body",
                "body"
              );

              const embeddedDoc = replaceEmbeddedPlaceholders(
                callEmbed(print, tagPath, embedMode, embeddedCode),
                placeholders
              );

              bodyDocs.push(
                b.group([
                  opts.markoSyntax === "html"
                    ? ""
                    : b.ifBreak("--", " --", { groupId }),
                  opts.markoSyntax === "html" ? "" : b.line,
                  embeddedDoc,
                  opts.markoSyntax === "html"
                    ? ""
                    : b.ifBreak([b.softline, "--"]),
                ])
              );
            } else {
              let textDocs = [] as Doc[];
              tagPath.each(
                (child, i) => {
                  const childNode = child.getValue();
                  const isText = isTextLike(childNode, node);

                  if (isText) {
                    textDocs.push(print(child));
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
                      ])
                    );

                    if (!isText) {
                      textDocs = [];
                      bodyDocs.push(print(child));
                    }
                  } else {
                    bodyDocs.push(print(child));
                  }
                },
                "body",
                "body"
              );
            }

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
          const attrPath = path as AstPath<t.MarkoAttribute>;
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
                    b.join([",", b.line], attrPath.map(print, "arguments")),
                    opts.trailingComma ? b.ifBreak(",") : "",
                  ]),
                  b.softline,
                  ")",
                ])
              );
            }
          }

          if (node.default || !t.isBooleanLiteral(value, { value: true })) {
            if (
              t.isFunctionExpression(value) &&
              !(value.id || value.async || value.generator)
            ) {
              doc.push(
                b.group([
                  "(",
                  value.params.length
                    ? callEmbed(
                        print,
                        attrPath,
                        "params",
                        getOriginalCodeForList(opts, ",", value.params)
                      )
                    : "",
                  ")",
                ]),
                b.group([
                  " {",
                  b.indent([
                    b.line,
                    b.join(
                      b.hardline,
                      (attrPath as any).map(print, "value", "body", "body")
                    ),
                  ]),
                  b.line,
                  "}",
                ])
              );
            } else {
              doc.push(
                node.bound ? ":=" : "=",
                b.group(
                  enclosedNodeTypeReg.test(node.type)
                    ? attrPath.call(print, "value")
                    : withParensIfNeeded(value, opts, () =>
                        attrPath.call(print, "value")
                      )
                )
              );
            }
          }

          return doc;
        }
        case "MarkoSpreadAttribute": {
          return (["..."] as Doc[]).concat(
            withParensIfNeeded(node.value, opts, () =>
              (path as AstPath<t.MarkoSpreadAttribute>).call(print, "value")
            )
          );
        }
        case "MarkoPlaceholder":
          return [
            node.escape ? "${" : "$!{",
            (path as AstPath<t.MarkoPlaceholder>).call(print, "value"),
            "}",
          ];
        case "MarkoScriptlet":
          return withLineIfNeeded(
            node.body[0],
            opts,
            b.group([
              node.static ? "static " : "$ ",
              withBlockIfNeeded(node.body, opts, () => path.map(print, "body")),
            ])
          );
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
            asLiteralTextContent(value)
          );
        }
        default:
          throw new Error(`Unknown node type in Marko template: ${node.type}`);
      }
    },
    embed(path, print, toDoc, opts) {
      const node = path.getValue();

      switch (node.type) {
        case "_MarkoEmbed":
          switch (node.mode) {
            case "var": {
              return tryPrintEmbed(
                `var ${node.code}=_`,
                opts.markoScriptParser,
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
                node.code
              );
            }
            case "params": {
              return tryPrintEmbed(
                `(${node.code})=>_`,
                expressionParser,
                (doc: any) => {
                  const { contents } = doc.contents[0];
                  if (Array.isArray(contents) && contents[0].startsWith("(")) {
                    contents[0] = contents[0].slice(1);
                    contents[contents.length - 1] = contents[
                      contents.length - 1
                    ].slice(0, -1);
                  }

                  return contents;
                },
                node.code
              );
            }
            case "script":
              return tryPrintEmbed(node.code, opts.markoScriptParser);
            default: {
              if (!node.mode.startsWith("style.")) {
                return [b.trim, asLiteralTextContent(node.code)];
              }

              return tryPrintEmbed(node.code, node.mode.slice("style.".length));
            }
          }

        case "MarkoClass":
          return (toDoc as any)(
            `class ${getOriginalCodeForNode(opts, node.body)}`,
            { parser: expressionParser },
            { stripTrailingHardline: true }
          );
        case "File":
        case "Program":
          return null;
        default:
          if (node.type.startsWith("Marko")) {
            return null;
          }
      }

      if (t.isStatement(node)) {
        return tryPrintEmbed(
          getOriginalCodeForNode(opts, node),
          opts.markoScriptParser
        );
      } else {
        return tryPrintEmbed(
          getOriginalCodeForNode(opts, node),
          expressionParser
        );
      }

      function tryPrintEmbed(
        code: string,
        parser: string | CustomParser,
        normalize: (doc: Doc) => Doc = identity,
        fallback: string = code
      ) {
        try {
          return normalize(
            (toDoc as any)(code, { parser }, { stripTrailingHardline: true })
          );
        } catch {
          return [asLiteralTextContent(fallback)];
        }
      }
    },
  },
};

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
