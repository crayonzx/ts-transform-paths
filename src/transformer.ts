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
    after: [optionsFactory],
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

  return (sourceFile: ts.SourceFile) => {
    function getResolvedPathNode(node: ts.StringLiteral) {
      const resolvedPath = aliasResolver.resolve(
        sourceFile.fileName,
        node.text
      );
      return resolvedPath !== node.text
        ? ts.createStringLiteral(resolvedPath)
        : null;
    }

    function pathReplacer(node: ts.Node): ts.Node {
      if (ts.isStringLiteral(node)) {
        return getResolvedPathNode(node) || node;
      }
      return ts.visitEachChild(node, pathReplacer, context);
    }

    function visitor(node: ts.Node): ts.Node {
      /**
       * e.g.
       * - const x = require('path');
       * - const x = import('path');
       */
      if (ts.isCallExpression(node)) {
        const arg = node.arguments[0];
        const expression = node.expression;
        if (
          node.arguments.length === 1 &&
          ts.isIdentifier(expression) &&
          (expression.escapedText === "require" ||
            expression.escapedText === "import") &&
          ts.isStringLiteral(arg)
        ) {
          return ts.visitEachChild(node, pathReplacer, context);
        }
      }

      /**
       * e.g.
       * - import { x } from 'path';
       */
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        return ts.visitEachChild(node, pathReplacer, context);
      }

      /**
       * e.g.
       * - export { x } from 'path';
       */
      if (
        ts.isExportDeclaration(node) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        return ts.visitEachChild(node, pathReplacer, context);
      }

      /**
       * e.g.
       * - let y: import('path').x;
       */
      if (ts.isImportTypeNode(node)) {
        return ts.visitEachChild(node, pathReplacer, context);
      }

      /**
       * e.g.
       * - import x = require('path');
       */
      if (ts.isExternalModuleReference(node)) {
        return ts.visitEachChild(node, pathReplacer, context);
      }

      return ts.visitEachChild(node, visitor, context);
    }

    return ts.visitEachChild(sourceFile, visitor, context);
  };
}
