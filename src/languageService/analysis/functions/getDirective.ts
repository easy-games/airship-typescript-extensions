import type ts from "typescript";
import { Provider } from "../../../util/provider";

function isExclamationUnaryExpression(
	provider: Provider,
	node: ts.Expression,
): node is ts.PrefixUnaryExpression & { operator: ts.SyntaxKind.ExclamationToken } {
	const { ts } = provider;

	return ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken;
}

export enum CompilerDirective {
	SERVER,
	NOT_SERVER,
	CLIENT,
	NOT_CLIENT,
	EDITOR,
}

export function isIdentifierOrExclamationIdentifier(
	provider: Provider,
	expression: ts.Expression,
): expression is ts.Identifier | (ts.PrefixUnaryExpression & { operand: ts.Identifier }) {
	const { ts } = provider;

	return (
		ts.isIdentifier(expression) || (ts.isPrefixUnaryExpression(expression) && ts.isIdentifier(expression.operand))
	);
}

export function isCallExpressionOrExclamationCallExpression(
	provider: Provider,
	expression: ts.Expression,
): expression is ts.CallExpression | (ts.PrefixUnaryExpression & { operand: ts.CallExpression }) {
	const { ts } = provider;

	return (
		ts.isCallExpression(expression) ||
		(ts.isPrefixUnaryExpression(expression) && ts.isCallExpression(expression.operand))
	);
}

function isServerDirective(provider: Provider, expression: ts.Expression, includeImplicitCalls: boolean) {
	const {
		ts,
		symbols,
		typeChecker,
		symbols: { isServerSymbol },
	} = provider;

	if (isServerSymbol) {
		// Annoyingly this has to be hard coded...
		if (includeImplicitCalls && ts.isCallExpression(expression)) {
			const symbol = typeChecker.getSymbolAtLocation(expression.expression);
			if (!symbol) return false;
			return isServerSymbol === symbol;
		}
	}

	if (ts.isIdentifier(expression)) {
		const symbol = typeChecker.getSymbolAtLocation(expression);
		if (!symbol) return false;

		return symbols.$SERVER === symbol;
	}
}

export function isNotServerDirective(provider: Provider, expression: ts.Expression, includeImplicitCalls: boolean) {
	const { ts, symbols } = provider;

	if (isExclamationUnaryExpression(provider, expression)) {
		const symbol = provider.typeChecker.getSymbolAtLocation(expression.operand);
		if (!symbol) return false;
		return symbols.$SERVER === symbol;
	}
}

export function isNotClientDirective(provider: Provider, expression: ts.Expression, includeImplicitCalls: boolean) {
	const { ts, symbols } = provider;

	if (isExclamationUnaryExpression(provider, expression)) {
		const symbol = provider.typeChecker.getSymbolAtLocation(expression.operand);
		if (!symbol) return false;
		return symbols.$CLIENT === symbol;
	}
}

function isClientDirective(provider: Provider, expression: ts.Expression) {
	const { ts, symbols } = provider;

	if (ts.isIdentifier(expression)) {
		const symbol = provider.typeChecker.getSymbolAtLocation(expression);
		if (!symbol) return false;

		return symbols.$CLIENT === symbol;
	}
}

export function getDirective(
	provider: Provider,
	expression: ts.Expression,
	includeImplicitCalls: boolean,
): CompilerDirective | undefined {
	if (
		!isIdentifierOrExclamationIdentifier(provider, expression) &&
		!isCallExpressionOrExclamationCallExpression(provider, expression)
	) {
		return undefined;
	}

	if (isServerDirective(provider, expression, includeImplicitCalls)) {
		return CompilerDirective.SERVER;
	}

	if (isClientDirective(provider, expression)) {
		return CompilerDirective.CLIENT;
	}

	if (isNotClientDirective(provider, expression, includeImplicitCalls)) {
		return CompilerDirective.NOT_CLIENT;
	}

	if (isNotServerDirective(provider, expression, includeImplicitCalls)) {
		return CompilerDirective.NOT_SERVER;
	}

	return undefined;
}
