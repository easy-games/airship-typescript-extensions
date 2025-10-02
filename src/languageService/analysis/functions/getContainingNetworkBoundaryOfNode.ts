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

export function getContainingNetworkBoundaryOfNode(provider: Provider, node: ts.Node) {
	const { ts } = provider;

	for (const parentNode of visitParentNodes(node)) {
		if (ts.isIfStatement(parentNode)) {
			const result = parseDirectives(provider, parentNode.expression, true, true);

			if (result?.isServer && result.isClient) {
				return NetworkBoundary.Invalid;
			}

			if (result?.isServer) {
				return NetworkBoundary.Server;
			}

			if (result?.isClient) {
				return NetworkBoundary.Client;
			}
		}

		if (ts.isMethodDeclaration(parentNode)) {
			const boundary = getNetworkBoundaryOfMethod(provider, parentNode);
			return boundary;
		}
	}

	return NetworkBoundary.Shared;
}
