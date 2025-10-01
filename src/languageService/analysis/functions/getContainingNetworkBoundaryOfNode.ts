import ts from "typescript";
import { NetworkBoundary } from "../../../util/boundary";
import { Provider } from "../../../util/provider";
import { getNetworkBoundaryOfMethod } from "./getNetworkBoundaryOfMethod";
import { parseDirectives } from "./parseDirectives";

function* visitParentNodes(node: ts.Node) {
	let current = node;

	do {
		yield current;
		current = current.parent;
	} while (current);
}

export function getContainingNetworkBoundaryOfNode(provider: Provider, node: ts.Node) {
	for (const parentNode of visitParentNodes(node)) {
		if (ts.isIfStatement(parentNode)) {
			const result = parseDirectives(provider, parentNode.expression);
			if (result?.isServer) {
				return NetworkBoundary.Server;
			}

			if (result?.isClient) {
				return NetworkBoundary.Client;
			}
		}

		if (ts.isMethodDeclaration(parentNode)) {
			const boundary = getNetworkBoundaryOfMethod(provider, parentNode);
			provider.log("check method boundary", parentNode.getText(), boundary);
			return boundary;
		}
	}

	return NetworkBoundary.Shared;
}
