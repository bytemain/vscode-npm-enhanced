import * as path from "path";
import * as vscode from "vscode";
import {
  getLanguageService,
  PropertyASTNode,
  JSONDocument,
} from "vscode-json-languageservice";

const jsonLanguageService = getLanguageService({});

function getJson(content: string): any | null {
  try {
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

function doDependencyLink(
  jsonDocument: JSONDocument,
  document: vscode.TextDocument,
  field: string
) {
  const result: vscode.DocumentLink[] = [];
  const dependencies = jsonDocument.root?.children?.find((child) => {
    if (child.type === "property" && child.keyNode.value === field) {
      return true;
    }
  });
  if (dependencies) {
    const _valueNode = (dependencies as PropertyASTNode).valueNode;
    if (_valueNode?.type === "object") {
      _valueNode.children.forEach((child) => {
        if (child.type === "property") {
          result.push({
            range: new vscode.Range(
              document.positionAt(child.keyNode.offset),
              document.positionAt(child.keyNode.offset + child.keyNode.length)
            ),
            target: vscode.Uri.parse(
              path.join(
                document.uri.path,
                "..",
                "node_modules",
                child.keyNode.value,
                "package.json"
              )
            ),
          });
          if (child.valueNode) {
            result.push({
              range: new vscode.Range(
                document.positionAt(child.valueNode.offset),
                document.positionAt(
                  child.valueNode.offset + child.valueNode.length
                )
              ),
              target: vscode.Uri.parse(
                `https://npmjs.com/package/${child.keyNode.value}`
              ),
            });
          }
        }
      });
    }
  }
  return result;
}

export function activate(context: vscode.ExtensionContext) {
  vscode.languages.registerHoverProvider(
    { scheme: "file", language: "json" },
    {
      async provideHover(document, position, token) {
        const jsonDoc = jsonLanguageService.parseJSONDocument({
          ...document,
          uri: document.uri.toString()!,
        });
        const node = jsonDoc.getNodeFromOffset(document.offsetAt(position));
        let tmpNode = node?.parent;

        let depType = "";
        while (tmpNode) {
          if (
            tmpNode.type === "property" &&
            tmpNode.keyNode.type === "string" &&
            (tmpNode.keyNode.value === "dependencies" ||
              tmpNode.keyNode.value === "devDependencies")
          ) {
            depType = tmpNode.keyNode.value;
            break;
          }

          tmpNode = tmpNode?.parent;
        }

        if (depType) {
          return new vscode.Hover(
            `当前位置是 ${depType}, value: ${node?.value}`
          );
        }
      },
    }
  );

  vscode.languages.registerDocumentLinkProvider(
    {
      scheme: "file",
      language: "json",
    },
    {
      provideDocumentLinks(document) {
        if (document.uri.path.endsWith("package.json")) {
          const json = getJson(document.getText());
          if (json) {
            const result: vscode.DocumentLink[] = [];
            const jsonDocument = jsonLanguageService.parseJSONDocument({
              ...document,
              uri: document.uri.toString()!,
            });
            console.log(jsonDocument);
            const main_ = jsonDocument.root?.children?.find((child) => {
              if (child.type === "property" && child.keyNode.value === "main") {
                return true;
              }
            });
            if (main_) {
              const _valueNode = (main_ as PropertyASTNode).valueNode;
              if (_valueNode?.type === "string") {
                result.push({
                  range: new vscode.Range(
                    document.positionAt(_valueNode.offset),
                    document.positionAt(_valueNode.offset + _valueNode.length)
                  ),
                  target: vscode.Uri.parse(
                    path.join(document.uri.path, "..", json.main)
                  ),
                });
              }
            }

            result.push(
              ...doDependencyLink(jsonDocument, document, "dependencies"),
              ...doDependencyLink(jsonDocument, document, "devDependencies")
            );
            return result;
          }
        }
      },
    }
  );
}

export function deactivate() {}
