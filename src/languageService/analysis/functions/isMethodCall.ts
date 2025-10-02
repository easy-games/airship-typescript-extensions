import type ts from "typescript";
import { Provider } from "../../../util/provider";

export function isMethodCall(provider: Provider, callExpression: ts.CallExpression) {
	const symbol = provider.typeChecker.getSymbolAtLocation(callExpression.expression);
	if (!symbol) return false;
	if (!symbol.valueDeclaration) return false;
	return provider.ts.isMethodDeclaration(symbol.valueDeclaration);
}
