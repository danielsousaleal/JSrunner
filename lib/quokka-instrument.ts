import * as ts from "typescript";

export const LIVE_REPORT_FN = "__jsRunnerLive$";
export const LIVE_MARK_FN = "__jsRunnerLiveMark$";

function isConsoleCall(expr: ts.Expression): expr is ts.CallExpression {
  if (!ts.isCallExpression(expr)) return false;
  const callee = expr.expression;
  return (
    ts.isPropertyAccessExpression(callee) &&
    ts.isIdentifier(callee.expression) &&
    callee.expression.text === "console"
  );
}

function isFunctionLike(expr: ts.Expression): boolean {
  return (
    ts.isArrowFunction(expr) ||
    ts.isFunctionExpression(expr) ||
    ts.isClassExpression(expr)
  );
}

function isMethodCall(expr: ts.Expression): expr is ts.CallExpression {
  return (
    ts.isCallExpression(expr) &&
    (ts.isPropertyAccessExpression(expr.expression) ||
      ts.isElementAccessExpression(expr.expression))
  );
}

export function createQuokkaTransformer(): ts.TransformerFactory<ts.SourceFile> {
  return (context) => {
    const { factory } = context;

    return (sourceFile) => {
      const fileName = sourceFile.fileName;
      const instrumented = new Set<number>();

      const getLine = (node: ts.Node): number => {
        const start = node.getStart(sourceFile, false);
        return sourceFile.getLineAndCharacterOfPosition(start).line + 1;
      };

      const wrap = (
        expression: ts.Expression,
        line: number,
        name = ""
      ): ts.CallExpression => {
        instrumented.add(line);
        return factory.createCallExpression(
          factory.createIdentifier(LIVE_REPORT_FN),
          undefined,
          [
            expression,
            factory.createNumericLiteral(line),
            factory.createStringLiteral(name),
            factory.createStringLiteral(fileName),
          ]
        );
      };

      const visitExpr = (expression: ts.Expression): ts.Expression => {
        return (ts.visitNode(expression, visit) as ts.Expression) ?? expression;
      };

      const wrapConsole = (
        expr: ts.CallExpression,
        line: number
      ): ts.CallExpression => {
        const args = expr.arguments.map((arg) => visitExpr(arg as ts.Expression));
        const reported = wrap(
          factory.createArrayLiteralExpression(args, false),
          line,
          "log"
        );
        return factory.updateCallExpression(expr, expr.expression, expr.typeArguments, [
          factory.createSpreadElement(reported),
        ]);
      };

      const visit = (node: ts.Node): ts.Node => {
        if (ts.isVariableDeclaration(node) && node.initializer) {
          const initializer = visitExpr(node.initializer);
          if (isFunctionLike(node.initializer)) {
            return factory.updateVariableDeclaration(
              node,
              node.name,
              node.exclamationToken,
              node.type,
              initializer
            );
          }
          const line = getLine(node);
          const name = ts.isIdentifier(node.name) ? node.name.text : "";
          return factory.updateVariableDeclaration(
            node,
            node.name,
            node.exclamationToken,
            node.type,
            wrap(initializer, line, name)
          );
        }

        if (ts.isExpressionStatement(node)) {
          const line = getLine(node.expression);
          if (isConsoleCall(node.expression)) {
            return factory.updateExpressionStatement(
              node,
              wrapConsole(node.expression, line)
            );
          }

          if (isMethodCall(node.expression)) {
            return factory.updateExpressionStatement(
              node,
              visitExpr(node.expression)
            );
          }

          let name = "";
          if (
            ts.isBinaryExpression(node.expression) &&
            node.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            ts.isIdentifier(node.expression.left)
          ) {
            name = node.expression.left.text;
          }

          return factory.updateExpressionStatement(
            node,
            wrap(visitExpr(node.expression), line, name)
          );
        }

        if (ts.isReturnStatement(node) && node.expression) {
          const line = getLine(node);
          return factory.updateReturnStatement(
            node,
            wrap(visitExpr(node.expression), line)
          );
        }

        if (ts.isArrowFunction(node) && !ts.isBlock(node.body)) {
          const line = getLine(node.body);
          return factory.updateArrowFunction(
            node,
            node.modifiers,
            node.typeParameters,
            node.parameters,
            node.type,
            node.equalsGreaterThanToken,
            wrap(visitExpr(node.body), line)
          );
        }

        if (ts.isExportAssignment(node) && !node.isExportEquals) {
          const line = getLine(node.expression);
          return factory.updateExportAssignment(
            node,
            node.modifiers,
            wrap(visitExpr(node.expression), line)
          );
        }

        return ts.visitEachChild(node, visit, context);
      };

      const visited = ts.visitEachChild(sourceFile, visit, context);
      const mark = factory.createExpressionStatement(
        factory.createCallExpression(
          factory.createIdentifier(LIVE_MARK_FN),
          undefined,
          [
            factory.createStringLiteral(fileName),
            factory.createArrayLiteralExpression(
              [...instrumented]
                .sort((a, b) => a - b)
                .map((line) => factory.createNumericLiteral(line))
            ),
          ]
        )
      );

      return factory.updateSourceFile(visited, [mark, ...visited.statements]);
    };
  };
}
