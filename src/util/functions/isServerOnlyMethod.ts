import ts from "typescript";

export function getMethodDeclaration(valueDeclaration: ts.Declaration | undefined) {
	if (!valueDeclaration) return undefined;

	if (ts.isMethodDeclaration(valueDeclaration)) return valueDeclaration;
	return undefined;
}

export function isServerMethod(methodDeclaration: ts.MethodDeclaration) {
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
