import type ts from "typescript";
import { Provider } from "../util/provider";
import { normalizeType } from "../util/functions/normalizeType";
import { isNodeInternal } from "../util/functions/isNodeInternal";
import { boundaryCanSee, getNetworkBoundary, NetworkBoundary } from "../util/boundary";
import { findPrecedingType } from "../util/functions/findPrecedingType";
import { getWithDefault } from "../util/functions/getOrDefault";
import { getBoundaryAtPosition } from "../util/functions/getBoundaryAtPosition";
import { findPrecedingSymbol } from "../util/functions/findPrecedingSymbol";
import path from "path";

interface ModifiedEntry {
	remove?: boolean;
	source?: string;
	boundary?: NetworkBoundary;
}

/**
 * Create the getCompletionsAtPosition method.
 */
export function getCompletionsAtPositionFactory(provider: Provider): ts.LanguageService["getCompletionsAtPosition"] {
	const { service, config, ts } = provider;

	/**
	 * Check if the specified entry is an auto import and is a source file.
	 * @param file The file path.
	 * @param pos The position.
	 * @param entry The entry to check.
	 */
	function isAutoImport(entry: ts.CompletionEntry): entry is ts.CompletionEntry & { source: string } {
		return !!(entry.hasAction && entry.source);
	}

	/**
	 * Gets the inherited members (class implements) for a node.
	 * This also includes the node itself.
	 * @param node The node to get inherited members for.
	 */
	function getPossibleMembers(node: ts.Node) {
		const members = [node];
		if (!ts.isClassElement(node)) return members;
		if (!node.name) return members;

		const name = ts.getNameFromPropertyName(node.name);
		if (name && ts.isClassLike(node.parent)) {
			const implementNodes = ts.getEffectiveImplementsTypeNodes(node.parent);
			if (implementNodes) {
				for (const implement of implementNodes) {
					const symbol = provider.getSymbol(implement.expression);
					const member = symbol?.members?.get(ts.escapeLeadingUnderscores(name));
					if (member && member.declarations) {
						for (const declaration of member.declarations) {
							members.push(declaration);
						}
					}
				}
			}
		}

		return members;
	}

	/**
	 * Determines what actions should be done on this symbol.
	 * @param symbol The symbol to check
	 * @param inScope Is this symbol in scope, or in a field expression?
	 */
	function getModifications(symbol: ts.Symbol, isAccessExpression = false, source?: string) {
		const modifiedEntry: ModifiedEntry = {
			remove: false,
			source,
		};

		const declarations = symbol.getDeclarations() ?? [];
		for (const declaration of declarations) {
			for (const node of getPossibleMembers(declaration)) {
				for (const tag of ts.getJSDocTags(node)) {
					const name = tag.tagName.text;
					// If this symbol has the @hidden tag, remove
					if (name === "hidden") modifiedEntry.remove = true;
					// If this symbol has the @hideinherited tag, remove if this is an inherited node
					if (name === "hideinherited" && node !== declaration) modifiedEntry.remove = true;
					// If this symbol has the @(server|client|shared) tag, set boundary
					if (name === "server") modifiedEntry.boundary = NetworkBoundary.Server;
					if (name === "client") modifiedEntry.boundary = NetworkBoundary.Client;
					if (name === "shared") modifiedEntry.boundary = NetworkBoundary.Shared;
				}
			}
		}

		if (isAccessExpression) {
			// If this is Function.prototype or class.prototype
			if (symbol.name === "prototype") {
				if (!symbol.declarations) {
					modifiedEntry.remove = true;
				} else {
					const isInternal = declarations.some((declaration) => isNodeInternal(provider, declaration));
					if (isInternal) modifiedEntry.remove = true;
				}
			}
		}

		return modifiedEntry;
	}

	/**
	 * Pushes all export symbols into an out array.
	 */
	function getExportSymbols(symbol: ts.Symbol, out: Array<ts.Symbol>) {
		const typeChecker = provider.program.getTypeChecker();
		for (const exportSymbol of typeChecker.getExportsOfModule(symbol)) {
			out.push(exportSymbol);
		}
	}

	/**
	 * Retrieve the symbols that can be imported.
	 * @param sourceFile The source file
	 * @returns An array of symbols that can be imported
	 */
	function getAutoImportSuggestions(): Array<ts.Symbol> {
		const typeChecker = provider.program.getTypeChecker();
		const symbols = new Array<ts.Symbol>();
		for (const ambientSymbol of typeChecker.getAmbientModules()) {
			if (!ambientSymbol.name.includes("*")) {
				getExportSymbols(ambientSymbol, symbols);
			}
		}
		for (const file of provider.program.getSourceFiles()) {
			if (ts.isExternalModule(file) || file.commonJsModuleIndicator !== undefined) {
				getExportSymbols(typeChecker.getMergedSymbol(file.symbol), symbols);
			}
		}
		return symbols;
	}

	/**
	 * Retrieves the file name for a completion entry.
	 */
	function getCompletionSource(entry: ts.CompletionEntry) {
		if (entry.data?.fileName) {
			return entry.data.fileName;
		}

		if (entry.source) {
			if (path.isAbsolute(entry.source)) {
				return entry.source;
			} else {
				provider.log(`Invalid source for entry ${entry.name}: ${entry.source}`);
			}
		}

		return "";
	}

	/**
	 * Get the SymbolFlags based on a precedingToken.
	 * @param precedingToken The precedingToken
	 * @returns The flags for the precedingToken
	 */
	function getScopeFlags(precedingToken: ts.Node): ts.SymbolFlags {
		const typeOnly = precedingToken ? ts.isValidTypeOnlyAliasUseSite(precedingToken) : false;
		return (
			(typeOnly ? ts.SymbolFlags.Type : ts.SymbolFlags.Value) | ts.SymbolFlags.Namespace | ts.SymbolFlags.Alias
		);
	}

	return (file, pos, opt) => {
		const fileBoundary = getNetworkBoundary(provider, file);
		const orig = service.getCompletionsAtPosition(file, pos, opt);
		if (orig) {
			const modifiedEntries = new Map<string, Array<ModifiedEntry>>();
			const sourceFile = provider.getSourceFile(file);
			const typeChecker = provider.program.getTypeChecker();
			let scopeBoundary = fileBoundary;
			if (sourceFile) {
				const token = ts.findPrecedingToken(pos, sourceFile) ?? sourceFile.endOfFileToken;
				scopeBoundary = getBoundaryAtPosition(provider, token) ?? scopeBoundary;
				const type = findPrecedingType(provider, token);
				const symbol = findPrecedingSymbol(provider, token);
				if (type) {
					normalizeType(type).forEach((subtype) => {
						for (const symbol of subtype.getApparentProperties()) {
							getWithDefault(modifiedEntries, symbol.name, []).push(getModifications(symbol, true));
						}
					});
				} else if (symbol && symbol.exports) {
					symbol.exports.forEach((propSymbol) => {
						getWithDefault(modifiedEntries, propSymbol.name, []).push(getModifications(propSymbol, true));
					});
				} else {
					typeChecker.getSymbolsInScope(token, getScopeFlags(token)).forEach((symbol) => {
						getWithDefault(modifiedEntries, symbol.name, []).push(getModifications(symbol));
					});
					getAutoImportSuggestions().forEach((symbol) => {
						if (!symbol.parent) return;
						getWithDefault(modifiedEntries, symbol.name, []).push(
							getModifications(symbol, false, ts.stripQuotes(symbol.parent.name)),
						);
					});
				}
			}
			const entries: ts.CompletionEntry[] = [];
			orig.entries.forEach((v) => {
				const modifiers = v.kindModifiers;
				const modification = modifiedEntries.get(v.name)?.find((entry) => entry.source === v.source) ?? {};
				if (modifiers?.includes("deprecated") && config.hideDeprecated) return;
				if (modification.remove) return;

				const isImport = isAutoImport(v);
				const boundaryAtContext = isImport ? fileBoundary : scopeBoundary;
				const completionBoundary =
					modification.boundary ?? getNetworkBoundary(provider, getCompletionSource(v));
				if (boundaryAtContext && !boundaryCanSee(boundaryAtContext, completionBoundary)) {
					if (config.mode === "prefix") {
						v.insertText = v.name;
						v.name = completionBoundary + ": " + v.name;
					} else if (config.mode === "remove") return;
				}

				entries.push(v);
			});
			orig.entries = entries;
		}
		return orig;
	};
}
