import type ts from "typescript";
import { NetworkBoundary } from "../../../util/boundary";
import { Provider } from "../../../util/provider";

function getNetworkBoundaryTrivia(node: ts.MethodDeclaration | ts.FunctionDeclaration): NetworkBoundary | undefined {
	const trivia = node.jsDoc;
	if (trivia) {
		for (const doc of trivia) {
			if (doc.tags === undefined) continue;
			for (const tag of doc.tags) {
				const tagText = tag.tagName.text;

				if (tagText === "server") return NetworkBoundary.Server;
				if (tagText === "client") return NetworkBoundary.Client;
			}
		}
	}

	return undefined;
}

export function getNetworkBoundaryOfMethod(
	provider: Provider,
	node: ts.MethodDeclaration,
	// checkBody = false,
): NetworkBoundary {
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

	const triviaBoundary = getNetworkBoundaryTrivia(node);
	if (triviaBoundary) return triviaBoundary;

	return NetworkBoundary.Shared;
}

export function getNetworkBoundaryOfFunction(provider: Provider, node: ts.FunctionDeclaration): NetworkBoundary {
	const boundary = getNetworkBoundaryTrivia(node);
	if (boundary) return boundary;
	return NetworkBoundary.Shared;
}
