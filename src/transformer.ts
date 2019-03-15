import * as ts from "typescript";
import { ITransformerOptions, PathAliasResolver } from "./types";

export default function transformer(
  program: ts.Program,
  options?: ITransformerOptions
): ts.CustomTransformers {
  function optionsFactory(context: ts.TransformationContext) {
    return transformerFactory(context, options);
  }

  return {
    before: [optionsFactory],
    afterDeclarations: [
      optionsFactory
    ] as ts.CustomTransformers["afterDeclarations"]
  };
}

export function transformerFactory(
  context: ts.TransformationContext,
  options?: ITransformerOptions
) {
  const aliasResolver = new PathAliasResolver(context.getCompilerOptions());

  function visitNode(node: ts.Node): ts.Node {
    if (!ts.isStringLiteral(node)) {
      return node;
    }
    if (!isImportPath(node) && !isExportPath(node) && !isRequirePath(node)) {
      return node;
    }

    return ts.createStringLiteral(
      aliasResolver.resolve(node.getSourceFile().fileName, node.text)
    );
  }

  function visitNodeAndChildren(
    node: ts.SourceFile,
    context: ts.TransformationContext
  ): ts.SourceFile;
  function visitNodeAndChildren(
    node: ts.Node,
    context: ts.TransformationContext
  ): ts.Node;
  function visitNodeAndChildren(
    node: ts.Node,
    context: ts.TransformationContext
  ): ts.Node {
    return ts.visitEachChild(
      visitNode(node),
      (childNode) => visitNodeAndChildren(childNode, context),
      context
    );
  }

  return (file: ts.SourceFile) => visitNodeAndChildren(file, context);
}

/**
 * e.g.
 * - import { x } from 'path';
 * - let y: import('path').x;
 */
function isImportPath(node: ts.StringLiteral) {
  return (
    node.parent &&
    (ts.isImportDeclaration(node.parent) ||
      ts.isImportTypeNode(node.parent.parent))
  );
}

/**
 * e.g.
 * - export { x } from 'path';
 */
function isExportPath(node: ts.StringLiteral) {
  return ts.isExportDeclaration(node.parent);
}

/**
 * e.g.
 * - const x = require('path');
 * - const x = import('path');
 * - import x = require('path');
 */
function isRequirePath(node: ts.StringLiteral) {
  const { parent } = node;
  return (
    (ts.isCallExpression(parent) &&
      parent.arguments.length === 1 &&
      (parent.expression.getText() === "require" ||
        parent.expression.getText() === "import")) ||
    ts.isExternalModuleReference(parent)
  );
}
