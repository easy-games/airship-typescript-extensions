import type ts from "typescript";
import { Provider } from "../provider";

export function getMethodDeclaration(provider: Provider, valueDeclaration: ts.Declaration | undefined) {
	const { ts } = provider;

	if (!valueDeclaration) return undefined;

	if (ts.isMethodDeclaration(valueDeclaration)) return valueDeclaration;
	return undefined;
}

export function isServerMethod(provider: Provider, methodDeclaration: ts.MethodDeclaration) {
	const { ts } = provider;

	const modifiers = methodDeclaration.modifiers;

	if (modifiers) {
		for (const modifier of modifiers) {
			if (!ts.isDecorator(modifier)) continue;
			if (ts.isCallExpression(modifier.expression) && ts.isIdentifier(modifier.expression.expression)) {
				return modifier.expression.expression.text === "Server";
			}
		}
	}

	return false;
}
