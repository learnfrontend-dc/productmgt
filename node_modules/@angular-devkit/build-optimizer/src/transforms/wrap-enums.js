"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const ts = require("typescript");
const ast_utils_1 = require("../helpers/ast-utils");
function testWrapEnums(content) {
    // TODO: remove this method, it's not doing anything anymore.
    return true;
}
exports.testWrapEnums = testWrapEnums;
function isBlockLike(node) {
    return node.kind === ts.SyntaxKind.Block
        || node.kind === ts.SyntaxKind.ModuleBlock
        || node.kind === ts.SyntaxKind.CaseClause
        || node.kind === ts.SyntaxKind.DefaultClause
        || node.kind === ts.SyntaxKind.SourceFile;
}
function getWrapEnumsTransformer() {
    return (context) => {
        const transformer = (sf) => {
            const result = visitBlockStatements(sf.statements, context);
            return ts.updateSourceFileNode(sf, ts.setTextRange(result, sf.statements));
        };
        return transformer;
    };
}
exports.getWrapEnumsTransformer = getWrapEnumsTransformer;
function visitBlockStatements(statements, context) {
    // copy of statements to modify; lazy initialized
    let updatedStatements;
    const visitor = (node) => {
        if (isBlockLike(node)) {
            let result = visitBlockStatements(node.statements, context);
            if (result === node.statements) {
                return node;
            }
            result = ts.setTextRange(result, node.statements);
            switch (node.kind) {
                case ts.SyntaxKind.Block:
                    return ts.updateBlock(node, result);
                case ts.SyntaxKind.ModuleBlock:
                    return ts.updateModuleBlock(node, result);
                case ts.SyntaxKind.CaseClause:
                    const clause = node;
                    return ts.updateCaseClause(clause, clause.expression, result);
                case ts.SyntaxKind.DefaultClause:
                    return ts.updateDefaultClause(node, result);
                default:
                    return node;
            }
        }
        else {
            return ts.visitEachChild(node, visitor, context);
        }
    };
    // 'oIndex' is the original statement index; 'uIndex' is the updated statement index
    for (let oIndex = 0, uIndex = 0; oIndex < statements.length; oIndex++, uIndex++) {
        const currentStatement = statements[oIndex];
        // these can't contain an enum declaration
        if (currentStatement.kind === ts.SyntaxKind.ImportDeclaration) {
            continue;
        }
        // enum declarations must:
        //   * not be last statement
        //   * be a variable statement
        //   * have only one declaration
        //   * have an identifer as a declaration name
        if (oIndex < statements.length - 1
            && ts.isVariableStatement(currentStatement)
            && currentStatement.declarationList.declarations.length === 1) {
            const variableDeclaration = currentStatement.declarationList.declarations[0];
            if (ts.isIdentifier(variableDeclaration.name)) {
                const name = variableDeclaration.name.text;
                if (!variableDeclaration.initializer) {
                    const iife = findTs2_3EnumIife(name, statements[oIndex + 1]);
                    if (iife) {
                        // found an enum
                        if (!updatedStatements) {
                            updatedStatements = statements.slice();
                        }
                        // update IIFE and replace variable statement and old IIFE
                        updatedStatements.splice(uIndex, 2, updateEnumIife(currentStatement, iife));
                        // skip IIFE statement
                        oIndex++;
                        continue;
                    }
                }
                else if (ts.isObjectLiteralExpression(variableDeclaration.initializer)
                    && variableDeclaration.initializer.properties.length === 0) {
                    const enumStatements = findTs2_2EnumStatements(name, statements, oIndex + 1);
                    if (enumStatements.length > 0) {
                        // found an enum
                        if (!updatedStatements) {
                            updatedStatements = statements.slice();
                        }
                        // create wrapper and replace variable statement and enum member statements
                        updatedStatements.splice(uIndex, enumStatements.length + 1, createWrappedEnum(name, currentStatement, enumStatements, variableDeclaration.initializer));
                        // skip enum member declarations
                        oIndex += enumStatements.length;
                        continue;
                    }
                }
                else if (ts.isObjectLiteralExpression(variableDeclaration.initializer)
                    && variableDeclaration.initializer.properties.length !== 0) {
                    const literalPropertyCount = variableDeclaration.initializer.properties.length;
                    const enumStatements = findEnumNameStatements(name, statements, oIndex + 1);
                    if (enumStatements.length === literalPropertyCount) {
                        // found an enum
                        if (!updatedStatements) {
                            updatedStatements = statements.slice();
                        }
                        // create wrapper and replace variable statement and enum member statements
                        updatedStatements.splice(uIndex, enumStatements.length + 1, createWrappedEnum(name, currentStatement, enumStatements, variableDeclaration.initializer));
                        // skip enum member declarations
                        oIndex += enumStatements.length;
                        continue;
                    }
                }
            }
        }
        const result = ts.visitNode(currentStatement, visitor);
        if (result !== currentStatement) {
            if (!updatedStatements) {
                updatedStatements = statements.slice();
            }
            updatedStatements[uIndex] = result;
        }
    }
    // if changes, return updated statements
    // otherwise, return original array instance
    return updatedStatements ? ts.createNodeArray(updatedStatements) : statements;
}
// TS 2.3 enums have statements that are inside a IIFE.
function findTs2_3EnumIife(name, statement) {
    if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) {
        return null;
    }
    const funcExpr = ast_utils_1.drilldownNodes(statement, [
        { prop: null, kind: ts.SyntaxKind.ExpressionStatement },
        { prop: 'expression', kind: ts.SyntaxKind.CallExpression },
        { prop: 'expression', kind: ts.SyntaxKind.ParenthesizedExpression },
        { prop: 'expression', kind: ts.SyntaxKind.FunctionExpression },
    ]);
    if (funcExpr === null) {
        return null;
    }
    if (!(funcExpr.parameters.length === 1
        && funcExpr.parameters[0].name.kind === ts.SyntaxKind.Identifier
        && funcExpr.parameters[0].name.text === name)) {
        return null;
    }
    // In TS 2.3 enums, the IIFE contains only expressions with a certain format.
    // If we find any that is different, we ignore the whole thing.
    for (const innerStmt of funcExpr.body.statements) {
        const innerBinExpr = ast_utils_1.drilldownNodes(innerStmt, [
            { prop: null, kind: ts.SyntaxKind.ExpressionStatement },
            { prop: 'expression', kind: ts.SyntaxKind.BinaryExpression },
        ]);
        if (innerBinExpr === null) {
            return null;
        }
        if (!(innerBinExpr.operatorToken.kind === ts.SyntaxKind.FirstAssignment
            && innerBinExpr.left.kind === ts.SyntaxKind.ElementAccessExpression)) {
            return null;
        }
        const innerElemAcc = innerBinExpr.left;
        if (!(innerElemAcc.expression.kind === ts.SyntaxKind.Identifier
            && innerElemAcc.expression.text === name
            && innerElemAcc.argumentExpression
            && innerElemAcc.argumentExpression.kind === ts.SyntaxKind.BinaryExpression)) {
            return null;
        }
        const innerArgBinExpr = innerElemAcc.argumentExpression;
        if (innerArgBinExpr.left.kind !== ts.SyntaxKind.ElementAccessExpression) {
            return null;
        }
        const innerArgElemAcc = innerArgBinExpr.left;
        if (!(innerArgElemAcc.expression.kind === ts.SyntaxKind.Identifier
            && innerArgElemAcc.expression.text === name)) {
            return null;
        }
    }
    return statement.expression;
}
// TS 2.2 enums have statements after the variable declaration, with index statements followed
// by value statements.
function findTs2_2EnumStatements(name, statements, statementOffset) {
    const enumValueStatements = [];
    const memberNames = [];
    let index = statementOffset;
    for (; index < statements.length; ++index) {
        // Ensure all statements are of the expected format and using the right identifer.
        // When we find a statement that isn't part of the enum, return what we collected so far.
        const current = statements[index];
        if (!ts.isExpressionStatement(current) || !ts.isBinaryExpression(current.expression)) {
            break;
        }
        const property = current.expression.left;
        if (!property || !ts.isPropertyAccessExpression(property)) {
            break;
        }
        if (!ts.isIdentifier(property.expression) || property.expression.text !== name) {
            break;
        }
        memberNames.push(property.name.text);
        enumValueStatements.push(current);
    }
    if (enumValueStatements.length === 0) {
        return [];
    }
    const enumNameStatements = findEnumNameStatements(name, statements, index, memberNames);
    if (enumNameStatements.length !== enumValueStatements.length) {
        return [];
    }
    return enumValueStatements.concat(enumNameStatements);
}
// Tsickle enums have a variable statement with indexes, followed by value statements.
// See https://github.com/angular/devkit/issues/229#issuecomment-338512056 fore more information.
function findEnumNameStatements(name, statements, statementOffset, memberNames) {
    const enumStatements = [];
    for (let index = statementOffset; index < statements.length; ++index) {
        // Ensure all statements are of the expected format and using the right identifer.
        // When we find a statement that isn't part of the enum, return what we collected so far.
        const current = statements[index];
        if (!ts.isExpressionStatement(current) || !ts.isBinaryExpression(current.expression)) {
            break;
        }
        const access = current.expression.left;
        const value = current.expression.right;
        if (!access || !ts.isElementAccessExpression(access) || !value || !ts.isStringLiteral(value)) {
            break;
        }
        if (memberNames && !memberNames.includes(value.text)) {
            break;
        }
        if (!ts.isIdentifier(access.expression) || access.expression.text !== name) {
            break;
        }
        if (!access.argumentExpression || !ts.isPropertyAccessExpression(access.argumentExpression)) {
            break;
        }
        const enumExpression = access.argumentExpression.expression;
        if (!ts.isIdentifier(enumExpression) || enumExpression.text !== name) {
            break;
        }
        if (value.text !== access.argumentExpression.name.text) {
            break;
        }
        enumStatements.push(current);
    }
    return enumStatements;
}
function updateHostNode(hostNode, expression) {
    const pureFunctionComment = '@__PURE__';
    // Update existing host node with the pure comment before the variable declaration initializer.
    const variableDeclaration = hostNode.declarationList.declarations[0];
    const outerVarStmt = ts.updateVariableStatement(hostNode, hostNode.modifiers, ts.updateVariableDeclarationList(hostNode.declarationList, [
        ts.updateVariableDeclaration(variableDeclaration, variableDeclaration.name, variableDeclaration.type, ts.addSyntheticLeadingComment(expression, ts.SyntaxKind.MultiLineCommentTrivia, pureFunctionComment, false)),
    ]));
    return outerVarStmt;
}
function updateEnumIife(hostNode, iife) {
    if (!ts.isParenthesizedExpression(iife.expression)
        || !ts.isFunctionExpression(iife.expression.expression)) {
        throw new Error('Invalid IIFE Structure');
    }
    const expression = iife.expression.expression;
    const updatedFunction = ts.updateFunctionExpression(expression, expression.modifiers, expression.asteriskToken, expression.name, expression.typeParameters, expression.parameters, expression.type, ts.updateBlock(expression.body, [
        ...expression.body.statements,
        ts.createReturn(expression.parameters[0].name),
    ]));
    const updatedIife = ts.updateCall(iife, ts.updateParen(iife.expression, updatedFunction), iife.typeArguments, [ts.createObjectLiteral()]);
    return updateHostNode(hostNode, updatedIife);
}
function createWrappedEnum(name, hostNode, statements, literalInitializer) {
    literalInitializer = literalInitializer || ts.createObjectLiteral();
    const innerVarStmt = ts.createVariableStatement(undefined, ts.createVariableDeclarationList([
        ts.createVariableDeclaration(name, undefined, literalInitializer),
    ]));
    const innerReturn = ts.createReturn(ts.createIdentifier(name));
    const iife = ts.createImmediatelyInvokedFunctionExpression([
        innerVarStmt,
        ...statements,
        innerReturn,
    ]);
    return updateHostNode(hostNode, ts.createParen(iife));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid3JhcC1lbnVtcy5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfb3B0aW1pemVyL3NyYy90cmFuc2Zvcm1zL3dyYXAtZW51bXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQTs7Ozs7O0dBTUc7QUFDSCxpQ0FBaUM7QUFDakMsb0RBQXNEO0FBR3RELHVCQUE4QixPQUFlO0lBQzNDLDZEQUE2RDtJQUM3RCxNQUFNLENBQUMsSUFBSSxDQUFDO0FBQ2QsQ0FBQztBQUhELHNDQUdDO0FBRUQscUJBQXFCLElBQWE7SUFDaEMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxLQUFLO1dBQ2pDLElBQUksQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxXQUFXO1dBQ3ZDLElBQUksQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxVQUFVO1dBQ3RDLElBQUksQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxhQUFhO1dBQ3pDLElBQUksQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUM7QUFDaEQsQ0FBQztBQUVEO0lBQ0UsTUFBTSxDQUFDLENBQUMsT0FBaUMsRUFBaUMsRUFBRTtRQUMxRSxNQUFNLFdBQVcsR0FBa0MsQ0FBQyxFQUFpQixFQUFFLEVBQUU7WUFFdkUsTUFBTSxNQUFNLEdBQUcsb0JBQW9CLENBQUMsRUFBRSxDQUFDLFVBQVUsRUFBRSxPQUFPLENBQUMsQ0FBQztZQUU1RCxNQUFNLENBQUMsRUFBRSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUM3RSxDQUFDLENBQUM7UUFFRixNQUFNLENBQUMsV0FBVyxDQUFDO0lBQ3JCLENBQUMsQ0FBQztBQUNK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QixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFFL0QsTUFBTSxJQUFJLEdBQUcsRUFBRSxDQUFDLDBDQUEwQyxDQUFDO1FBQ3pELFlBQVk7UUFDWixHQUFHLFVBQVU7UUFDYixXQUFXO0tBQ1osQ0FBQyxDQUFDO0lBRUgsTUFBTSxDQUFDLGNBQWMsQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ3hELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCB7IGRyaWxsZG93bk5vZGVzIH0gZnJvbSAnLi4vaGVscGVycy9hc3QtdXRpbHMnO1xuXG5cbmV4cG9ydCBmdW5jdGlvbiB0ZXN0V3JhcEVudW1zKGNvbnRlbnQ6IHN0cmluZykge1xuICAvLyBUT0RPOiByZW1vdmUgdGhpcyBtZXRob2QsIGl0J3Mgbm90IGRvaW5nIGFueXRoaW5nIGFueW1vcmUuXG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBpc0Jsb2NrTGlrZShub2RlOiB0cy5Ob2RlKTogbm9kZSBpcyB0cy5CbG9ja0xpa2Uge1xuICByZXR1cm4gbm9kZS5raW5kID09PSB0cy5TeW50YXhLaW5kLkJsb2NrXG4gICAgICB8fCBub2RlLmtpbmQgPT09IHRzLlN5bnRheEtpbmQuTW9kdWxlQmxvY2tcbiAgICAgIHx8IG5vZGUua2luZCA9PT0gdHMuU3ludGF4S2luZC5DYXNlQ2xhdXNlXG4gICAgICB8fCBub2RlLmtpbmQgPT09IHRzLlN5bnRheEtpbmQuRGVmYXVsdENsYXVzZVxuICAgICAgfHwgbm9kZS5raW5kID09PSB0cy5TeW50YXhLaW5kLlNvdXJjZUZpbGU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRXcmFwRW51bXNUcmFuc2Zvcm1lcigpOiB0cy5UcmFuc2Zvcm1lckZhY3Rvcnk8dHMuU291cmNlRmlsZT4ge1xuICByZXR1cm4gKGNvbnRleHQ6IHRzLlRyYW5zZm9ybWF0aW9uQ29udGV4dCk6IHRzLlRyYW5zZm9ybWVyPHRzLlNvdXJjZUZpbGU+ID0+IHtcbiAgICBjb25zdCB0cmFuc2Zvcm1lcjogdHMuVHJhbnNmb3JtZXI8dHMuU291cmNlRmlsZT4gPSAoc2Y6IHRzLlNvdXJjZUZpbGUpID0+IHtcblxuICAgICAgY29uc3QgcmVzdWx0ID0gdmlzaXRCbG9ja1N0YXRlbWVudHMoc2Yuc3RhdGVtZW50cywgY29udGV4dCk7XG5cbiAgICAgIHJldHVybiB0cy51cGRhdGVTb3VyY2VGaWxlTm9kZShzZiwgdHMuc2V0VGV4dFJhbmdlKHJlc3VsdCwgc2Yuc3RhdGVtZW50cykpO1xuICAgIH07XG5cbiAgICByZXR1cm4gdHJhbnNmb3JtZXI7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHZpc2l0QmxvY2tTdGF0ZW1lbnRzKFxuICBzdGF0ZW1lbnRzOiB0cy5Ob2RlQXJyYXk8dHMuU3RhdGVtZW50PixcbiAgY29udGV4dDogdHMuVHJhbnNmb3JtYXRpb25Db250ZXh0LFxuKTogdHMuTm9kZUFycmF5PHRzLlN0YXRlbWVudD4ge1xuXG4gIC8vIGNvcHkgb2Ygc3RhdGVtZW50cyB0byBtb2RpZnk7IGxhenkgaW5pdGlhbGl6ZWRcbiAgbGV0IHVwZGF0ZWRTdGF0ZW1lbnRzOiBBcnJheTx0cy5TdGF0ZW1lbnQ+IHwgdW5kZWZpbmVkO1xuXG4gIGNvbnN0IHZpc2l0b3I6IHRzLlZpc2l0b3IgPSAobm9kZSkgPT4ge1xuICAgIGlmIChpc0Jsb2NrTGlrZShub2RlKSkge1xuICAgICAgbGV0IHJlc3VsdCA9IHZpc2l0QmxvY2tTdGF0ZW1lbnRzKG5vZGUuc3RhdGVtZW50cywgY29udGV4dCk7XG4gICAgICBpZiAocmVzdWx0ID09PSBub2RlLnN0YXRlbWVudHMpIHtcbiAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgICB9XG4gICAgICByZXN1bHQgPSB0cy5zZXRUZXh0UmFuZ2UocmVzdWx0LCBub2RlLnN0YXRlbWVudHMpO1xuICAgICAgc3dpdGNoIChub2RlLmtpbmQpIHtcbiAgICAgICAgY2FzZSB0cy5TeW50YXhLaW5kLkJsb2NrOlxuICAgICAgICAgIHJldHVybiB0cy51cGRhdGVCbG9jayhub2RlIGFzIHRzLkJsb2NrLCByZXN1bHQpO1xuICAgICAgICBjYXNlIHRzLlN5bnRheEtpbmQuTW9kdWxlQmxvY2s6XG4gICAgICAgICAgcmV0dXJuIHRzLnVwZGF0ZU1vZHVsZUJsb2NrKG5vZGUgYXMgdHMuTW9kdWxlQmxvY2ssIHJlc3VsdCk7XG4gICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5DYXNlQ2xhdXNlOlxuICAgICAgICAgIGNvbnN0IGNsYXVzZSA9IG5vZGUgYXMgdHMuQ2FzZUNsYXVzZTtcblxuICAgICAgICAgIHJldHVybiB0cy51cGRhdGVDYXNlQ2xhdXNlKGNsYXVzZSwgY2xhdXNlLmV4cHJlc3Npb24sIHJlc3VsdCk7XG4gICAgICAgIGNhc2UgdHMuU3ludGF4S2luZC5EZWZhdWx0Q2xhdXNlOlxuICAgICAgICAgIHJldHVybiB0cy51cGRhdGVEZWZhdWx0Q2xhdXNlKG5vZGUgYXMgdHMuRGVmYXVsdENsYXVzZSwgcmVzdWx0KTtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICByZXR1cm4gbm9kZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRzLnZpc2l0RWFjaENoaWxkKG5vZGUsIHZpc2l0b3IsIGNvbnRleHQpO1xuICAgIH1cbiAgfTtcblxuICAvLyAnb0luZGV4JyBpcyB0aGUgb3JpZ2luYWwgc3RhdGVtZW50IGluZGV4OyAndUluZGV4JyBpcyB0aGUgdXBkYXRlZCBzdGF0ZW1lbnQgaW5kZXhcbiAgZm9yIChsZXQgb0luZGV4ID0gMCwgdUluZGV4ID0gMDsgb0luZGV4IDwgc3RhdGVtZW50cy5sZW5ndGg7IG9JbmRleCsrLCB1SW5kZXgrKykge1xuICAgIGNvbnN0IGN1cnJlbnRTdGF0ZW1lbnQgPSBzdGF0ZW1lbnRzW29JbmRleF07XG5cbiAgICAvLyB0aGVzZSBjYW4ndCBjb250YWluIGFuIGVudW0gZGVjbGFyYXRpb25cbiAgICBpZiAoY3VycmVudFN0YXRlbWVudC5raW5kID09PSB0cy5TeW50YXhLaW5kLkltcG9ydERlY2xhcmF0aW9uKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBlbnVtIGRlY2xhcmF0aW9ucyBtdXN0OlxuICAgIC8vICAgKiBub3QgYmUgbGFzdCBzdGF0ZW1lbnRcbiAgICAvLyAgICogYmUgYSB2YXJpYWJsZSBzdGF0ZW1lbnRcbiAgICAvLyAgICogaGF2ZSBvbmx5IG9uZSBkZWNsYXJhdGlvblxuICAgIC8vICAgKiBoYXZlIGFuIGlkZW50aWZlciBhcyBhIGRlY2xhcmF0aW9uIG5hbWVcbiAgICBpZiAob0luZGV4IDwgc3RhdGVtZW50cy5sZW5ndGggLSAxXG4gICAgICAgICYmIHRzLmlzVmFyaWFibGVTdGF0ZW1lbnQoY3VycmVudFN0YXRlbWVudClcbiAgICAgICAgJiYgY3VycmVudFN0YXRlbWVudC5kZWNsYXJhdGlvbkxpc3QuZGVjbGFyYXRpb25zLmxlbmd0aCA9PT0gMSkge1xuXG4gICAgICBjb25zdCB2YXJpYWJsZURlY2xhcmF0aW9uID0gY3VycmVudFN0YXRlbWVudC5kZWNsYXJhdGlvbkxpc3QuZGVjbGFyYXRpb25zWzBdO1xuICAgICAgaWYgKHRzLmlzSWRlbnRpZmllcih2YXJpYWJsZURlY2xhcmF0aW9uLm5hbWUpKSB7XG4gICAgICAgIGNvbnN0IG5hbWUgPSB2YXJpYWJsZURlY2xhcmF0aW9uLm5hbWUudGV4dDtcblxuICAgICAgICBpZiAoIXZhcmlhYmxlRGVjbGFyYXRpb24uaW5pdGlhbGl6ZXIpIHtcbiAgICAgICAgICBjb25zdCBpaWZlID0gZmluZFRzMl8zRW51bUlpZmUobmFtZSwgc3RhdGVtZW50c1tvSW5kZXggKyAxXSk7XG4gICAgICAgICAgaWYgKGlpZmUpIHtcbiAgICAgICAgICAgIC8vIGZvdW5kIGFuIGVudW1cbiAgICAgICAgICAgIGlmICghdXBkYXRlZFN0YXRlbWVudHMpIHtcbiAgICAgICAgICAgICAgdXBkYXRlZFN0YXRlbWVudHMgPSBzdGF0ZW1lbnRzLnNsaWNlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyB1cGRhdGUgSUlGRSBhbmQgcmVwbGFjZSB2YXJpYWJsZSBzdGF0ZW1lbnQgYW5kIG9sZCBJSUZFXG4gICAgICAgICAgICB1cGRhdGVkU3RhdGVtZW50cy5zcGxpY2UodUluZGV4LCAyLCB1cGRhdGVFbnVtSWlmZShcbiAgICAgICAgICAgICAgY3VycmVudFN0YXRlbWVudCxcbiAgICAgICAgICAgICAgaWlmZSxcbiAgICAgICAgICAgICkpO1xuICAgICAgICAgICAgLy8gc2tpcCBJSUZFIHN0YXRlbWVudFxuICAgICAgICAgICAgb0luZGV4Kys7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAodHMuaXNPYmplY3RMaXRlcmFsRXhwcmVzc2lvbih2YXJpYWJsZURlY2xhcmF0aW9uLmluaXRpYWxpemVyKVxuICAgICAgICAgICAgICAgICAgICYmIHZhcmlhYmxlRGVjbGFyYXRpb24uaW5pdGlhbGl6ZXIucHJvcGVydGllcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBjb25zdCBlbnVtU3RhdGVtZW50cyA9IGZpbmRUczJfMkVudW1TdGF0ZW1lbnRzKG5hbWUsIHN0YXRlbWVudHMsIG9JbmRleCArIDEpO1xuICAgICAgICAgIGlmIChlbnVtU3RhdGVtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAvLyBmb3VuZCBhbiBlbnVtXG4gICAgICAgICAgICBpZiAoIXVwZGF0ZWRTdGF0ZW1lbnRzKSB7XG4gICAgICAgICAgICAgIHVwZGF0ZWRTdGF0ZW1lbnRzID0gc3RhdGVtZW50cy5zbGljZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gY3JlYXRlIHdyYXBwZXIgYW5kIHJlcGxhY2UgdmFyaWFibGUgc3RhdGVtZW50IGFuZCBlbnVtIG1lbWJlciBzdGF0ZW1lbnRzXG4gICAgICAgICAgICB1cGRhdGVkU3RhdGVtZW50cy5zcGxpY2UodUluZGV4LCBlbnVtU3RhdGVtZW50cy5sZW5ndGggKyAxLCBjcmVhdGVXcmFwcGVkRW51bShcbiAgICAgICAgICAgICAgbmFtZSxcbiAgICAgICAgICAgICAgY3VycmVudFN0YXRlbWVudCxcbiAgICAgICAgICAgICAgZW51bVN0YXRlbWVudHMsXG4gICAgICAgICAgICAgIHZhcmlhYmxlRGVjbGFyYXRpb24uaW5pdGlhbGl6ZXIsXG4gICAgICAgICAgICApKTtcbiAgICAgICAgICAgIC8vIHNraXAgZW51bSBtZW1iZXIgZGVjbGFyYXRpb25zXG4gICAgICAgICAgICBvSW5kZXggKz0gZW51bVN0YXRlbWVudHMubGVuZ3RoO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHRzLmlzT2JqZWN0TGl0ZXJhbEV4cHJlc3Npb24odmFyaWFibGVEZWNsYXJhdGlvbi5pbml0aWFsaXplcilcbiAgICAgICAgICAmJiB2YXJpYWJsZURlY2xhcmF0aW9uLmluaXRpYWxpemVyLnByb3BlcnRpZXMubGVuZ3RoICE9PSAwKSB7XG4gICAgICAgICAgY29uc3QgbGl0ZXJhbFByb3BlcnR5Q291bnQgPSB2YXJpYWJsZURlY2xhcmF0aW9uLmluaXRpYWxpemVyLnByb3BlcnRpZXMubGVuZ3RoO1xuICAgICAgICAgIGNvbnN0IGVudW1TdGF0ZW1lbnRzID0gZmluZEVudW1OYW1lU3RhdGVtZW50cyhuYW1lLCBzdGF0ZW1lbnRzLCBvSW5kZXggKyAxKTtcbiAgICAgICAgICBpZiAoZW51bVN0YXRlbWVudHMubGVuZ3RoID09PSBsaXRlcmFsUHJvcGVydHlDb3VudCkge1xuICAgICAgICAgICAgLy8gZm91bmQgYW4gZW51bVxuICAgICAgICAgICAgaWYgKCF1cGRhdGVkU3RhdGVtZW50cykge1xuICAgICAgICAgICAgICB1cGRhdGVkU3RhdGVtZW50cyA9IHN0YXRlbWVudHMuc2xpY2UoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIGNyZWF0ZSB3cmFwcGVyIGFuZCByZXBsYWNlIHZhcmlhYmxlIHN0YXRlbWVudCBhbmQgZW51bSBtZW1iZXIgc3RhdGVtZW50c1xuICAgICAgICAgICAgdXBkYXRlZFN0YXRlbWVudHMuc3BsaWNlKHVJbmRleCwgZW51bVN0YXRlbWVudHMubGVuZ3RoICsgMSwgY3JlYXRlV3JhcHBlZEVudW0oXG4gICAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICAgIGN1cnJlbnRTdGF0ZW1lbnQsXG4gICAgICAgICAgICAgIGVudW1TdGF0ZW1lbnRzLFxuICAgICAgICAgICAgICB2YXJpYWJsZURlY2xhcmF0aW9uLmluaXRpYWxpemVyLFxuICAgICAgICAgICAgKSk7XG4gICAgICAgICAgICAvLyBza2lwIGVudW0gbWVtYmVyIGRlY2xhcmF0aW9uc1xuICAgICAgICAgICAgb0luZGV4ICs9IGVudW1TdGF0ZW1lbnRzLmxlbmd0aDtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHJlc3VsdCA9IHRzLnZpc2l0Tm9kZShjdXJyZW50U3RhdGVtZW50LCB2aXNpdG9yKTtcbiAgICBpZiAocmVzdWx0ICE9PSBjdXJyZW50U3RhdGVtZW50KSB7XG4gICAgICBpZiAoIXVwZGF0ZWRTdGF0ZW1lbnRzKSB7XG4gICAgICAgIHVwZGF0ZWRTdGF0ZW1lbnRzID0gc3RhdGVtZW50cy5zbGljZSgpO1xuICAgICAgfVxuICAgICAgdXBkYXRlZFN0YXRlbWVudHNbdUluZGV4XSA9IHJlc3VsdDtcbiAgICB9XG4gIH1cblxuICAvLyBpZiBjaGFuZ2VzLCByZXR1cm4gdXBkYXRlZCBzdGF0ZW1lbnRzXG4gIC8vIG90aGVyd2lzZSwgcmV0dXJuIG9yaWdpbmFsIGFycmF5IGluc3RhbmNlXG4gIHJldHVybiB1cGRhdGVkU3RhdGVtZW50cyA/IHRzLmNyZWF0ZU5vZGVBcnJheSh1cGRhdGVkU3RhdGVtZW50cykgOiBzdGF0ZW1lbnRzO1xufVxuXG4vLyBUUyAyLjMgZW51bXMgaGF2ZSBzdGF0ZW1lbnRzIHRoYXQgYXJlIGluc2lkZSBhIElJRkUuXG5mdW5jdGlvbiBmaW5kVHMyXzNFbnVtSWlmZShuYW1lOiBzdHJpbmcsIHN0YXRlbWVudDogdHMuU3RhdGVtZW50KTogdHMuQ2FsbEV4cHJlc3Npb24gfCBudWxsIHtcbiAgaWYgKCF0cy5pc0V4cHJlc3Npb25TdGF0ZW1lbnQoc3RhdGVtZW50KSB8fCAhdHMuaXNDYWxsRXhwcmVzc2lvbihzdGF0ZW1lbnQuZXhwcmVzc2lvbikpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGNvbnN0IGZ1bmNFeHByID0gZHJpbGxkb3duTm9kZXM8dHMuRnVuY3Rpb25FeHByZXNzaW9uPihzdGF0ZW1lbnQsXG4gICAgW1xuICAgICAgeyBwcm9wOiBudWxsLCBraW5kOiB0cy5TeW50YXhLaW5kLkV4cHJlc3Npb25TdGF0ZW1lbnQgfSxcbiAgICAgIHsgcHJvcDogJ2V4cHJlc3Npb24nLCBraW5kOiB0cy5TeW50YXhLaW5kLkNhbGxFeHByZXNzaW9uIH0sXG4gICAgICB7IHByb3A6ICdleHByZXNzaW9uJywga2luZDogdHMuU3ludGF4S2luZC5QYXJlbnRoZXNpemVkRXhwcmVzc2lvbiB9LFxuICAgICAgeyBwcm9wOiAnZXhwcmVzc2lvbicsIGtpbmQ6IHRzLlN5bnRheEtpbmQuRnVuY3Rpb25FeHByZXNzaW9uIH0sXG4gICAgXSk7XG5cbiAgaWYgKGZ1bmNFeHByID09PSBudWxsKSB7IHJldHVybiBudWxsOyB9XG5cbiAgaWYgKCEoXG4gICAgZnVuY0V4cHIucGFyYW1ldGVycy5sZW5ndGggPT09IDFcbiAgICAmJiBmdW5jRXhwci5wYXJhbWV0ZXJzWzBdLm5hbWUua2luZCA9PT0gdHMuU3ludGF4S2luZC5JZGVudGlmaWVyXG4gICAgJiYgKGZ1bmNFeHByLnBhcmFtZXRlcnNbMF0ubmFtZSBhcyB0cy5JZGVudGlmaWVyKS50ZXh0ID09PSBuYW1lXG4gICkpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8vIEluIFRTIDIuMyBlbnVtcywgdGhlIElJRkUgY29udGFpbnMgb25seSBleHByZXNzaW9ucyB3aXRoIGEgY2VydGFpbiBmb3JtYXQuXG4gIC8vIElmIHdlIGZpbmQgYW55IHRoYXQgaXMgZGlmZmVyZW50LCB3ZSBpZ25vcmUgdGhlIHdob2xlIHRoaW5nLlxuICBmb3IgKGNvbnN0IGlubmVyU3RtdCBvZiBmdW5jRXhwci5ib2R5LnN0YXRlbWVudHMpIHtcblxuICAgIGNvbnN0IGlubmVyQmluRXhwciA9IGRyaWxsZG93bk5vZGVzPHRzLkJpbmFyeUV4cHJlc3Npb24+KGlubmVyU3RtdCxcbiAgICAgIFtcbiAgICAgICAgeyBwcm9wOiBudWxsLCBraW5kOiB0cy5TeW50YXhLaW5kLkV4cHJlc3Npb25TdGF0ZW1lbnQgfSxcbiAgICAgICAgeyBwcm9wOiAnZXhwcmVzc2lvbicsIGtpbmQ6IHRzLlN5bnRheEtpbmQuQmluYXJ5RXhwcmVzc2lvbiB9LFxuICAgICAgXSk7XG5cbiAgICBpZiAoaW5uZXJCaW5FeHByID09PSBudWxsKSB7IHJldHVybiBudWxsOyB9XG5cbiAgICBpZiAoIShpbm5lckJpbkV4cHIub3BlcmF0b3JUb2tlbi5raW5kID09PSB0cy5TeW50YXhLaW5kLkZpcnN0QXNzaWdubWVudFxuICAgICAgICAmJiBpbm5lckJpbkV4cHIubGVmdC5raW5kID09PSB0cy5TeW50YXhLaW5kLkVsZW1lbnRBY2Nlc3NFeHByZXNzaW9uKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgaW5uZXJFbGVtQWNjID0gaW5uZXJCaW5FeHByLmxlZnQgYXMgdHMuRWxlbWVudEFjY2Vzc0V4cHJlc3Npb247XG5cbiAgICBpZiAoIShcbiAgICAgIGlubmVyRWxlbUFjYy5leHByZXNzaW9uLmtpbmQgPT09IHRzLlN5bnRheEtpbmQuSWRlbnRpZmllclxuICAgICAgJiYgKGlubmVyRWxlbUFjYy5leHByZXNzaW9uIGFzIHRzLklkZW50aWZpZXIpLnRleHQgPT09IG5hbWVcbiAgICAgICYmIGlubmVyRWxlbUFjYy5hcmd1bWVudEV4cHJlc3Npb25cbiAgICAgICYmIGlubmVyRWxlbUFjYy5hcmd1bWVudEV4cHJlc3Npb24ua2luZCA9PT0gdHMuU3ludGF4S2luZC5CaW5hcnlFeHByZXNzaW9uXG4gICAgKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgaW5uZXJBcmdCaW5FeHByID0gaW5uZXJFbGVtQWNjLmFyZ3VtZW50RXhwcmVzc2lvbiBhcyB0cy5CaW5hcnlFeHByZXNzaW9uO1xuXG4gICAgaWYgKGlubmVyQXJnQmluRXhwci5sZWZ0LmtpbmQgIT09IHRzLlN5bnRheEtpbmQuRWxlbWVudEFjY2Vzc0V4cHJlc3Npb24pIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGlubmVyQXJnRWxlbUFjYyA9IGlubmVyQXJnQmluRXhwci5sZWZ0IGFzIHRzLkVsZW1lbnRBY2Nlc3NFeHByZXNzaW9uO1xuXG4gICAgaWYgKCEoXG4gICAgICBpbm5lckFyZ0VsZW1BY2MuZXhwcmVzc2lvbi5raW5kID09PSB0cy5TeW50YXhLaW5kLklkZW50aWZpZXJcbiAgICAgICYmIChpbm5lckFyZ0VsZW1BY2MuZXhwcmVzc2lvbiBhcyB0cy5JZGVudGlmaWVyKS50ZXh0ID09PSBuYW1lXG4gICAgKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHN0YXRlbWVudC5leHByZXNzaW9uO1xufVxuXG4vLyBUUyAyLjIgZW51bXMgaGF2ZSBzdGF0ZW1lbnRzIGFmdGVyIHRoZSB2YXJpYWJsZSBkZWNsYXJhdGlvbiwgd2l0aCBpbmRleCBzdGF0ZW1lbnRzIGZvbGxvd2VkXG4vLyBieSB2YWx1ZSBzdGF0ZW1lbnRzLlxuZnVuY3Rpb24gZmluZFRzMl8yRW51bVN0YXRlbWVudHMoXG4gIG5hbWU6IHN0cmluZyxcbiAgc3RhdGVtZW50czogdHMuTm9kZUFycmF5PHRzLlN0YXRlbWVudD4sXG4gIHN0YXRlbWVudE9mZnNldDogbnVtYmVyLFxuKTogdHMuU3RhdGVtZW50W10ge1xuICBjb25zdCBlbnVtVmFsdWVTdGF0ZW1lbnRzOiB0cy5TdGF0ZW1lbnRbXSA9IFtdO1xuICBjb25zdCBtZW1iZXJOYW1lczogc3RyaW5nW10gPSBbXTtcblxuICBsZXQgaW5kZXggPSBzdGF0ZW1lbnRPZmZzZXQ7XG4gIGZvciAoOyBpbmRleCA8IHN0YXRlbWVudHMubGVuZ3RoOyArK2luZGV4KSB7XG4gICAgLy8gRW5zdXJlIGFsbCBzdGF0ZW1lbnRzIGFyZSBvZiB0aGUgZXhwZWN0ZWQgZm9ybWF0IGFuZCB1c2luZyB0aGUgcmlnaHQgaWRlbnRpZmVyLlxuICAgIC8vIFdoZW4gd2UgZmluZCBhIHN0YXRlbWVudCB0aGF0IGlzbid0IHBhcnQgb2YgdGhlIGVudW0sIHJldHVybiB3aGF0IHdlIGNvbGxlY3RlZCBzbyBmYXIuXG4gICAgY29uc3QgY3VycmVudCA9IHN0YXRlbWVudHNbaW5kZXhdO1xuICAgIGlmICghdHMuaXNFeHByZXNzaW9uU3RhdGVtZW50KGN1cnJlbnQpIHx8ICF0cy5pc0JpbmFyeUV4cHJlc3Npb24oY3VycmVudC5leHByZXNzaW9uKSkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgY29uc3QgcHJvcGVydHkgPSBjdXJyZW50LmV4cHJlc3Npb24ubGVmdDtcbiAgICBpZiAoIXByb3BlcnR5IHx8ICF0cy5pc1Byb3BlcnR5QWNjZXNzRXhwcmVzc2lvbihwcm9wZXJ0eSkpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIGlmICghdHMuaXNJZGVudGlmaWVyKHByb3BlcnR5LmV4cHJlc3Npb24pIHx8IHByb3BlcnR5LmV4cHJlc3Npb24udGV4dCAhPT0gbmFtZSkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgbWVtYmVyTmFtZXMucHVzaChwcm9wZXJ0eS5uYW1lLnRleHQpO1xuICAgIGVudW1WYWx1ZVN0YXRlbWVudHMucHVzaChjdXJyZW50KTtcbiAgfVxuXG4gIGlmIChlbnVtVmFsdWVTdGF0ZW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIGNvbnN0IGVudW1OYW1lU3RhdGVtZW50cyA9IGZpbmRFbnVtTmFtZVN0YXRlbWVudHMobmFtZSwgc3RhdGVtZW50cywgaW5kZXgsIG1lbWJlck5hbWVzKTtcbiAgaWYgKGVudW1OYW1lU3RhdGVtZW50cy5sZW5ndGggIT09IGVudW1WYWx1ZVN0YXRlbWVudHMubGVuZ3RoKSB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG5cbiAgcmV0dXJuIGVudW1WYWx1ZVN0YXRlbWVudHMuY29uY2F0KGVudW1OYW1lU3RhdGVtZW50cyk7XG59XG5cbi8vIFRzaWNrbGUgZW51bXMgaGF2ZSBhIHZhcmlhYmxlIHN0YXRlbWVudCB3aXRoIGluZGV4ZXMsIGZvbGxvd2VkIGJ5IHZhbHVlIHN0YXRlbWVudHMuXG4vLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvZGV2a2l0L2lzc3Vlcy8yMjkjaXNzdWVjb21tZW50LTMzODUxMjA1NiBmb3JlIG1vcmUgaW5mb3JtYXRpb24uXG5mdW5jdGlvbiBmaW5kRW51bU5hbWVTdGF0ZW1lbnRzKFxuICBuYW1lOiBzdHJpbmcsXG4gIHN0YXRlbWVudHM6IHRzLk5vZGVBcnJheTx0cy5TdGF0ZW1lbnQ+LFxuICBzdGF0ZW1lbnRPZmZzZXQ6IG51bWJlcixcbiAgbWVtYmVyTmFtZXM/OiBzdHJpbmdbXSxcbik6IHRzLlN0YXRlbWVudFtdIHtcbiAgY29uc3QgZW51bVN0YXRlbWVudHM6IHRzLlN0YXRlbWVudFtdID0gW107XG5cbiAgZm9yIChsZXQgaW5kZXggPSBzdGF0ZW1lbnRPZmZzZXQ7IGluZGV4IDwgc3RhdGVtZW50cy5sZW5ndGg7ICsraW5kZXgpIHtcbiAgICAvLyBFbnN1cmUgYWxsIHN0YXRlbWVudHMgYXJlIG9mIHRoZSBleHBlY3RlZCBmb3JtYXQgYW5kIHVzaW5nIHRoZSByaWdodCBpZGVudGlmZXIuXG4gICAgLy8gV2hlbiB3ZSBmaW5kIGEgc3RhdGVtZW50IHRoYXQgaXNuJ3QgcGFydCBvZiB0aGUgZW51bSwgcmV0dXJuIHdoYXQgd2UgY29sbGVjdGVkIHNvIGZhci5cbiAgICBjb25zdCBjdXJyZW50ID0gc3RhdGVtZW50c1tpbmRleF07XG4gICAgaWYgKCF0cy5pc0V4cHJlc3Npb25TdGF0ZW1lbnQoY3VycmVudCkgfHwgIXRzLmlzQmluYXJ5RXhwcmVzc2lvbihjdXJyZW50LmV4cHJlc3Npb24pKSB7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICBjb25zdCBhY2Nlc3MgPSBjdXJyZW50LmV4cHJlc3Npb24ubGVmdDtcbiAgICBjb25zdCB2YWx1ZSA9IGN1cnJlbnQuZXhwcmVzc2lvbi5yaWdodDtcbiAgICBpZiAoIWFjY2VzcyB8fCAhdHMuaXNFbGVtZW50QWNjZXNzRXhwcmVzc2lvbihhY2Nlc3MpIHx8ICF2YWx1ZSB8fCAhdHMuaXNTdHJpbmdMaXRlcmFsKHZhbHVlKSkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgaWYgKG1lbWJlck5hbWVzICYmICFtZW1iZXJOYW1lcy5pbmNsdWRlcyh2YWx1ZS50ZXh0KSkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgaWYgKCF0cy5pc0lkZW50aWZpZXIoYWNjZXNzLmV4cHJlc3Npb24pIHx8IGFjY2Vzcy5leHByZXNzaW9uLnRleHQgIT09IG5hbWUpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIGlmICghYWNjZXNzLmFyZ3VtZW50RXhwcmVzc2lvbiB8fCAhdHMuaXNQcm9wZXJ0eUFjY2Vzc0V4cHJlc3Npb24oYWNjZXNzLmFyZ3VtZW50RXhwcmVzc2lvbikpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIGNvbnN0IGVudW1FeHByZXNzaW9uID0gYWNjZXNzLmFyZ3VtZW50RXhwcmVzc2lvbi5leHByZXNzaW9uO1xuICAgIGlmICghdHMuaXNJZGVudGlmaWVyKGVudW1FeHByZXNzaW9uKSB8fCBlbnVtRXhwcmVzc2lvbi50ZXh0ICE9PSBuYW1lKSB7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICBpZiAodmFsdWUudGV4dCAhPT0gYWNjZXNzLmFyZ3VtZW50RXhwcmVzc2lvbi5uYW1lLnRleHQpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIGVudW1TdGF0ZW1lbnRzLnB1c2goY3VycmVudCk7XG4gIH1cblxuICByZXR1cm4gZW51bVN0YXRlbWVudHM7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUhvc3ROb2RlKGhvc3ROb2RlOiB0cy5WYXJpYWJsZVN0YXRlbWVudCwgZXhwcmVzc2lvbjogdHMuRXhwcmVzc2lvbik6IHRzLlN0YXRlbWVudCB7XG4gIGNvbnN0IHB1cmVGdW5jdGlvbkNvbW1lbnQgPSAnQF9fUFVSRV9fJztcblxuICAvLyBVcGRhdGUgZXhpc3RpbmcgaG9zdCBub2RlIHdpdGggdGhlIHB1cmUgY29tbWVudCBiZWZvcmUgdGhlIHZhcmlhYmxlIGRlY2xhcmF0aW9uIGluaXRpYWxpemVyLlxuICBjb25zdCB2YXJpYWJsZURlY2xhcmF0aW9uID0gaG9zdE5vZGUuZGVjbGFyYXRpb25MaXN0LmRlY2xhcmF0aW9uc1swXTtcbiAgY29uc3Qgb3V0ZXJWYXJTdG10ID0gdHMudXBkYXRlVmFyaWFibGVTdGF0ZW1lbnQoXG4gICAgaG9zdE5vZGUsXG4gICAgaG9zdE5vZGUubW9kaWZpZXJzLFxuICAgIHRzLnVwZGF0ZVZhcmlhYmxlRGVjbGFyYXRpb25MaXN0KFxuICAgICAgaG9zdE5vZGUuZGVjbGFyYXRpb25MaXN0LFxuICAgICAgW1xuICAgICAgICB0cy51cGRhdGVWYXJpYWJsZURlY2xhcmF0aW9uKFxuICAgICAgICAgIHZhcmlhYmxlRGVjbGFyYXRpb24sXG4gICAgICAgICAgdmFyaWFibGVEZWNsYXJhdGlvbi5uYW1lLFxuICAgICAgICAgIHZhcmlhYmxlRGVjbGFyYXRpb24udHlwZSxcbiAgICAgICAgICB0cy5hZGRTeW50aGV0aWNMZWFkaW5nQ29tbWVudChcbiAgICAgICAgICAgIGV4cHJlc3Npb24sXG4gICAgICAgICAgICB0cy5TeW50YXhLaW5kLk11bHRpTGluZUNvbW1lbnRUcml2aWEsXG4gICAgICAgICAgICBwdXJlRnVuY3Rpb25Db21tZW50LFxuICAgICAgICAgICAgZmFsc2UsXG4gICAgICAgICAgKSxcbiAgICAgICAgKSxcbiAgICAgIF0sXG4gICAgKSxcbiAgKTtcblxuICByZXR1cm4gb3V0ZXJWYXJTdG10O1xufVxuXG5mdW5jdGlvbiB1cGRhdGVFbnVtSWlmZShob3N0Tm9kZTogdHMuVmFyaWFibGVTdGF0ZW1lbnQsIGlpZmU6IHRzLkNhbGxFeHByZXNzaW9uKTogdHMuU3RhdGVtZW50IHtcbiAgaWYgKCF0cy5pc1BhcmVudGhlc2l6ZWRFeHByZXNzaW9uKGlpZmUuZXhwcmVzc2lvbilcbiAgICAgIHx8ICF0cy5pc0Z1bmN0aW9uRXhwcmVzc2lvbihpaWZlLmV4cHJlc3Npb24uZXhwcmVzc2lvbikpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgSUlGRSBTdHJ1Y3R1cmUnKTtcbiAgfVxuXG4gIGNvbnN0IGV4cHJlc3Npb24gPSBpaWZlLmV4cHJlc3Npb24uZXhwcmVzc2lvbjtcbiAgY29uc3QgdXBkYXRlZEZ1bmN0aW9uID0gdHMudXBkYXRlRnVuY3Rpb25FeHByZXNzaW9uKFxuICAgIGV4cHJlc3Npb24sXG4gICAgZXhwcmVzc2lvbi5tb2RpZmllcnMsXG4gICAgZXhwcmVzc2lvbi5hc3Rlcmlza1Rva2VuLFxuICAgIGV4cHJlc3Npb24ubmFtZSxcbiAgICBleHByZXNzaW9uLnR5cGVQYXJhbWV0ZXJzLFxuICAgIGV4cHJlc3Npb24ucGFyYW1ldGVycyxcbiAgICBleHByZXNzaW9uLnR5cGUsXG4gICAgdHMudXBkYXRlQmxvY2soXG4gICAgICBleHByZXNzaW9uLmJvZHksXG4gICAgICBbXG4gICAgICAgIC4uLmV4cHJlc3Npb24uYm9keS5zdGF0ZW1lbnRzLFxuICAgICAgICB0cy5jcmVhdGVSZXR1cm4oZXhwcmVzc2lvbi5wYXJhbWV0ZXJzWzBdLm5hbWUgYXMgdHMuSWRlbnRpZmllciksXG4gICAgICBdLFxuICAgICksXG4gICk7XG5cbiAgY29uc3QgdXBkYXRlZElpZmUgPSB0cy51cGRhdGVDYWxsKFxuICAgIGlpZmUsXG4gICAgdHMudXBkYXRlUGFyZW4oXG4gICAgICBpaWZlLmV4cHJlc3Npb24sXG4gICAgICB1cGRhdGVkRnVuY3Rpb24sXG4gICAgKSxcbiAgICBpaWZlLnR5cGVBcmd1bWVudHMsXG4gICAgW3RzLmNyZWF0ZU9iamVjdExpdGVyYWwoKV0sXG4gICk7XG5cbiAgcmV0dXJuIHVwZGF0ZUhvc3ROb2RlKGhvc3ROb2RlLCB1cGRhdGVkSWlmZSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVdyYXBwZWRFbnVtKFxuICBuYW1lOiBzdHJpbmcsXG4gIGhvc3ROb2RlOiB0cy5WYXJpYWJsZVN0YXRlbWVudCxcbiAgc3RhdGVtZW50czogQXJyYXk8dHMuU3RhdGVtZW50PixcbiAgbGl0ZXJhbEluaXRpYWxpemVyOiB0cy5PYmplY3RMaXRlcmFsRXhwcmVzc2lvbiB8IHVuZGVmaW5lZCxcbik6IHRzLlN0YXRlbWVudCB7XG4gIGxpdGVyYWxJbml0aWFsaXplciA9IGxpdGVyYWxJbml0aWFsaXplciB8fCB0cy5jcmVhdGVPYmplY3RMaXRlcmFsKCk7XG4gIGNvbnN0IGlubmVyVmFyU3RtdCA9IHRzLmNyZWF0ZVZhcmlhYmxlU3RhdGVtZW50KFxuICAgIHVuZGVmaW5lZCxcbiAgICB0cy5jcmVhdGVWYXJpYWJsZURlY2xhcmF0aW9uTGlzdChbXG4gICAgICB0cy5jcmVhdGVWYXJpYWJsZURlY2xhcmF0aW9uKG5hbWUsIHVuZGVmaW5lZCwgbGl0ZXJhbEluaXRpYWxpemVyKSxcbiAgICBdKSxcbiAgKTtcblxuICBjb25zdCBpbm5lclJldHVybiA9IHRzLmNyZWF0ZVJldHVybih0cy5jcmVhdGVJZGVudGlmaWVyKG5hbWUpKTtcblxuICBjb25zdCBpaWZlID0gdHMuY3JlYXRlSW1tZWRpYXRlbHlJbnZva2VkRnVuY3Rpb25FeHByZXNzaW9uKFtcbiAgICBpbm5lclZhclN0bXQsXG4gICAgLi4uc3RhdGVtZW50cyxcbiAgICBpbm5lclJldHVybixcbiAgXSk7XG5cbiAgcmV0dXJuIHVwZGF0ZUhvc3ROb2RlKGhvc3ROb2RlLCB0cy5jcmVhdGVQYXJlbihpaWZlKSk7XG59XG4iXX0=