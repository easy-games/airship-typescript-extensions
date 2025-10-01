import ts from "typescript";
import { Provider } from "../../../util/provider";

export enum CompilerDirective {
	SERVER,
	NOT_SERVER,
	CLIENT,
	NOT_CLIENT,
	EDITOR,
}

export function isIdentifierOrExclamationIdentifier(
	expression: ts.Expression,
): expression is ts.Identifier | (ts.PrefixUnaryExpression & { operand: ts.Identifier }) {
	return (
		ts.isIdentifier(expression) || (ts.isPrefixUnaryExpression(expression) && ts.isIdentifier(expression.operand))
	);
}

export function isCallExpressionOrExclamationCallExpression(
	expression: ts.Expression,
): expression is ts.CallExpression | (ts.PrefixUnaryExpression & { operand: ts.CallExpression }) {
	return (
		ts.isCallExpression(expression) ||
		(ts.isPrefixUnaryExpression(expression) && ts.isCallExpression(expression.operand))
	);
}

function isServerDirective(provider: Provider, expression: ts.Expression) {
	const { ts, symbols } = provider;

	if (ts.isIdentifier(expression)) {
		const symbol = provider.typeChecker.getSymbolAtLocation(expression);
		if (!symbol) return false;

		return symbols.resolveGlobalSymbol("$SERVER") === symbol;
	}
}

function isClientDirective(provider: Provider, expression: ts.Expression) {
	const { ts, symbols } = provider;

	if (ts.isIdentifier(expression)) {
		const symbol = provider.typeChecker.getSymbolAtLocation(expression);
		if (!symbol) return false;

		return symbols.resolveGlobalSymbol("$CLIENT") === symbol;
	}
}

export function getDirective(
	provider: Provider,
	expression: ts.Expression,
	includeImplicitCalls: boolean,
): CompilerDirective | undefined {
	if (!isIdentifierOrExclamationIdentifier(expression) && !isCallExpressionOrExclamationCallExpression(expression)) {
		return undefined;
	}

	if (isServerDirective(provider, expression)) {
		return CompilerDirective.SERVER;
	}

	if (isClientDirective(provider, expression)) {
		return CompilerDirective.CLIENT;
	}

	return undefined;
}
