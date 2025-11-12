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

function isNotServerDirective(provider: Provider, expression: ts.Expression, includeImplicitCalls: boolean) {
	const { ts, symbols, typeChecker } = provider;

	if (isExclamationUnaryExpression(provider, expression)) {
		if (includeImplicitCalls && symbols.isServerSymbol && ts.isCallExpression(expression.operand)) {
			const symbol = typeChecker.getSymbolAtLocation(expression.operand.expression);
			if (!symbol) return false;
			return symbols.isServerSymbol === symbol;
		}

		const symbol = provider.typeChecker.getSymbolAtLocation(expression.operand);
		if (!symbol) return false;
		return symbols.$SERVER === symbol;
	}

	return false;
}

function isNotClientDirective(provider: Provider, expression: ts.Expression, includeImplicitCalls: boolean) {
	const { ts, symbols, typeChecker } = provider;

	if (isExclamationUnaryExpression(provider, expression)) {
		if (includeImplicitCalls && symbols.isClientSymbol && ts.isCallExpression(expression.operand)) {
			const symbol = typeChecker.getSymbolAtLocation(expression.operand.expression);
			if (!symbol) return false;
			return symbols.isClientSymbol === symbol;
		}

		const symbol = provider.typeChecker.getSymbolAtLocation(expression.operand);
		if (!symbol) return false;
		return symbols.$CLIENT === symbol;
	}

	return false;
}

function isClientDirective(provider: Provider, expression: ts.Expression, includeImplicitCalls: boolean) {
	const { ts, typeChecker, symbols } = provider;

	if (symbols.isClientSymbol) {
		if (includeImplicitCalls && ts.isCallExpression(expression)) {
			const symbol = typeChecker.getSymbolAtLocation(expression.expression);
			if (!symbol) return false;
			return symbols.isClientSymbol === symbol;
		}
	}

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

	if (isClientDirective(provider, expression, includeImplicitCalls)) {
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
