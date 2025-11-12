import type ts from "typescript";
import { NetworkBoundary } from "../../../util/boundary";
import { Provider } from "../../../util/provider";
import { getNetworkBoundaryOfMethod } from "./getNetworkBoundaryOfMethod";
import { parseDirectives } from "./parseDirectives";

function* visitParentNodes(node: ts.Node) {
	let current = node.parent;

	do {
		yield current;
		current = current.parent;
	} while (current);
}

export function isEarlyReturningIfStatement(provider: Provider, statement: ts.Statement): statement is ts.IfStatement {
	const { ts } = provider;

	if (!ts.isIfStatement(statement)) return false;
	if (ts.isReturnStatement(statement.thenStatement)) return true;
	if (ts.isThrowStatement(statement.thenStatement)) return true;
	if (ts.isBlock(statement.thenStatement)) {
		const block = statement.thenStatement;
		if (block.statements.length === 0) return false;

		const last = block.statements[block.statements.length - 1];

		return ts.isReturnStatement(last) || ts.isThrowStatement(last);
	}

	return false;
}

export function isConditionOfIfStatement(provider: Provider, expression: ts.Node) {
	const { ts } = provider;

	return (
		findAncestorNode(
			expression,
			(node): node is ts.Node => {
				if (ts.isIfStatement(node)) {
					if (node.expression === expression || node.expression.getChildren().includes(expression))
						return true;
				}

				return false;
			},
			ts.isExpressionStatement,
		) !== undefined
	);
}

export function findAncestorNode<T extends ts.Node>(
	node: ts.Node,
	getNode: (value: ts.Node) => value is T,
	breakAtNode?: (value: ts.Node) => boolean,
) {
	// if (getNode(node)) return node;

	for (const parentNode of visitParentNodes(node)) {
		if (breakAtNode?.(parentNode)) break;
		if (getNode(parentNode)) return parentNode;
	}

	return undefined;
}

export function isValidIfStatementLocation(provider: Provider, node: ts.Node) {
	const { ts } = provider;

	let parent = node.parent;
	if (ts.isParenthesizedExpression(parent)) {
		parent = parent.parent;
	}

	if (ts.isExpressionStatement(parent)) {
		return true;
	}

	return false;
}

export interface ContainingBoundaryInfo {
	readonly boundary: NetworkBoundary;
	readonly boundaryNode: ts.Node | undefined;
}

export function getContainingNetworkBoundaryOfNode(provider: Provider, node: ts.Node): ContainingBoundaryInfo {
	const { ts } = provider;

	for (const parentNode of visitParentNodes(node)) {
		if (ts.isConditionalExpression(parentNode)) {
			const result = parseDirectives(provider, parentNode.condition, true, true);

			if (result?.isServer && result.isClient) {
				return { boundary: NetworkBoundary.Invalid, boundaryNode: parentNode };
			}

			if (result?.isServer) {
				return { boundary: NetworkBoundary.Server, boundaryNode: parentNode };
			}

			if (result?.isClient) {
				return { boundary: NetworkBoundary.Client, boundaryNode: parentNode };
			}
		}

		if (ts.isBlock(parentNode)) {
			for (const statement of parentNode.statements) {
				if (node === statement) break;
				if (!isEarlyReturningIfStatement(provider, statement)) continue;

				const condition = parseDirectives(provider, statement.expression, true, true);
				if (condition?.isServer) {
					return { boundary: NetworkBoundary.Client, boundaryNode: statement };
				}

				if (condition?.isClient) {
					return { boundary: NetworkBoundary.Server, boundaryNode: statement };
				}
			}
		}

		if (ts.isIfStatement(parentNode)) {
			const result = parseDirectives(provider, parentNode.expression, true, true);

			if (result?.isServer && result.isClient) {
				return { boundary: NetworkBoundary.Invalid, boundaryNode: parentNode };
			}

			if (result?.isServer) {
				return { boundary: NetworkBoundary.Server, boundaryNode: parentNode };
			}

			if (result?.isClient) {
				return { boundary: NetworkBoundary.Client, boundaryNode: parentNode };
			}
		}

		if (ts.isMethodDeclaration(parentNode)) {
			const boundary = getNetworkBoundaryOfMethod(provider, parentNode);
			return { boundary, boundaryNode: parentNode };
		}
	}

	return { boundary: NetworkBoundary.Shared, boundaryNode: undefined };
}
