import path from "path";
import { isPathDescendantOf } from "../project/util/fsUtil";
import { Provider } from "./provider";
import { ContainingBoundaryInfo } from "languageService/analysis/functions/getContainingNetworkBoundaryOfNode";

export enum NetworkBoundary {
	Client = "Client",
	Server = "Server",
	Host = "Host",
	Shared = "Shared",
	Invalid = "Invalid",
}

export function isValidBoundary(containingBoundaryInfo: ContainingBoundaryInfo, child: NetworkBoundary) {
	if (containingBoundaryInfo.boundary === NetworkBoundary.Server) {
		return child === NetworkBoundary.Server || child === NetworkBoundary.Host;
	}

	if (containingBoundaryInfo.boundary === NetworkBoundary.Client) {
		return child === NetworkBoundary.Client || child === NetworkBoundary.Host;
	}

	return containingBoundaryInfo.boundary === NetworkBoundary.Shared;
}

/**
 * Check if the specified file is in any of the directories.
 * @param file The file path.
 * @param directories The directories.
 */
function isInDirectories(file: string, currentDirectory: string, directories: string[]): boolean {
	return directories.some((directory) => isPathDescendantOf(file, path.join(currentDirectory, directory)));
}

function getNetworkBoundaryNoCache(provider: Provider, file: string): NetworkBoundary {
	const { currentDirectory, config } = provider;

	if (file.length === 0) return NetworkBoundary.Shared;
	// if (isInDirectories(file, currentDirectory, config.client)) return NetworkBoundary.Client;
	// if (isInDirectories(file, currentDirectory, config.server)) return NetworkBoundary.Server;

	// if (isInDirectories(file, currentDirectory, ["Client"])) return NetworkBoundary.Client;
	// if (isInDirectories(file, currentDirectory, ["Server"])) return NetworkBoundary.Server;

	return NetworkBoundary.Shared;
}

/**
 * Retrieve the boundary of a specific file.
 * @param file The file path.
 */
export function getNetworkBoundary(provider: Provider, file: string): NetworkBoundary {
	const cache = provider.boundaryCache;

	let result = cache.get(file);
	if (!result) cache.set(file, (result = getNetworkBoundaryNoCache(provider, file)));

	return result;
}

/**
 * Check if the two boundaries are able to view eachother. (Boundary <-> Boundary, Server -> Shared, Client -> Shared)
 * @param from The boundary of the current file.
 * @param to The boundary of the auto-complete.
 */
export function boundaryCanSee(from: NetworkBoundary, to: NetworkBoundary) {
	return from === to || to === NetworkBoundary.Shared;
}
