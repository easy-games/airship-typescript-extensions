import type ts from "typescript";
import { NetworkBoundary } from "../../../util/boundary";
import { Provider } from "../../../util/provider";

export function getNetworkBoundaryOfMethod(provider: Provider, node: ts.MethodDeclaration): NetworkBoundary {
	const { ts } = provider;

	const decorators = node.modifiers?.filter((f) => ts.isDecorator(f));
	if (!decorators) return NetworkBoundary.Shared;

	const serverSymbol = provider.symbols.resolveGlobalSymbol(provider, "Server");
	const clientSymbol = provider.symbols.resolveGlobalSymbol(provider, "Client");

	for (const decorator of decorators) {
		if (ts.isCallExpression(decorator.expression) && ts.isIdentifier(decorator.expression.expression)) {
			const symbolAtLocation = provider.typeChecker.getSymbolAtLocation(decorator.expression.expression);

			if (symbolAtLocation === serverSymbol) {
				return NetworkBoundary.Server;
			} else if (symbolAtLocation === clientSymbol) {
				return NetworkBoundary.Client;
			}
		}
	}

	return NetworkBoundary.Shared;
}
