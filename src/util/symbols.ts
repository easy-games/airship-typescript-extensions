import type ts from "typescript";
import { Provider } from "./provider";
import path from "path";

export class SymbolProvider {
	$CLIENT: ts.Symbol | undefined;
	$SERVER: ts.Symbol | undefined;
	isServerSymbol: ts.Symbol | undefined;
	isClientSymbol: ts.Symbol | undefined;

	platformNamespaceSymbol: ts.Symbol | undefined;
	platformServerNamespaceSymbol: ts.Symbol | undefined;
	platformClientNamespaceSymbol: ts.Symbol | undefined;

	public refresh(provider: Provider) {
		const { typeChecker, ts } = provider;

		this.$SERVER = this.resolveGlobalSymbol(provider, "$SERVER");
		this.$CLIENT = this.resolveGlobalSymbol(provider, "$CLIENT");

		const gameModuleFile = provider.getSourceFile("AirshipPackages/@Easy/Core/Shared/Game.ts");
		if (gameModuleFile) {
			const gameDeclaration = gameModuleFile.statements.find(
				(f): f is ts.ClassDeclaration => ts.isClassDeclaration(f) && f.name?.text === "Game",
			);

			if (gameDeclaration) {
				const isServer = gameDeclaration.members.find(
					(f): f is ts.MethodDeclaration & { name: ts.Identifier } =>
						ts.isMethodDeclaration(f) && ts.isIdentifier(f.name) && f.name.text === "IsServer",
				);
				if (isServer) this.isServerSymbol = typeChecker.getSymbolAtLocation(isServer.name);

				const isClient = gameDeclaration.members.find(
					(f): f is ts.MethodDeclaration & { name: ts.Identifier } =>
						ts.isMethodDeclaration(f) && ts.isIdentifier(f.name) && f.name.text === "IsClient",
				);
				if (isClient) this.isClientSymbol = typeChecker.getSymbolAtLocation(isClient.name);
			}
		}

		const airshipNamespacesFile = provider.getSourceFile("AirshipPackages/@Easy/Core/Shared/Airship.ts");
		if (airshipNamespacesFile) {
			const platformNamespaceDeclaration = airshipNamespacesFile.statements.find((f): f is ts.ModuleDeclaration => ts.isModuleDeclaration(f) && f.name.text === "Platform");
			
			if (platformNamespaceDeclaration) {
				this.platformNamespaceSymbol = typeChecker.getSymbolAtLocation(platformNamespaceDeclaration.name);
				// provider.log("ns symbol is", this.platformNamespaceSymbol ? typeChecker.symbolToString(this.platformNamespaceSymbol) : "none");

				if (platformNamespaceDeclaration.body && ts.isModuleBlock(platformNamespaceDeclaration.body)) {
					const platformServerNamespaceDeclaration = platformNamespaceDeclaration.body.statements.find((f): f is ts.ModuleDeclaration => ts.isModuleDeclaration(f) && f.name.text === "Server");
					if (platformServerNamespaceDeclaration) {
						this.platformServerNamespaceSymbol = typeChecker.getSymbolAtLocation(platformServerNamespaceDeclaration.name);
					}

					const platformClientNamespaceDeclaration = platformNamespaceDeclaration.body.statements.find((f): f is ts.ModuleDeclaration => ts.isModuleDeclaration(f) && f.name.text === "Client");
					if (platformClientNamespaceDeclaration) {
						this.platformClientNamespaceSymbol = typeChecker.getSymbolAtLocation(platformClientNamespaceDeclaration.name);
					}
				}
			} else {
				provider.log("could not find ns symbol");
			}
		}

	}

	// public getSymbolByName(name: keyof typeof SYMBOL_NAMES) {
	// 	const symbol = this.symbols.get(name);

	// 	if (!symbol) {
	// 		this.provider.pushDiagnostic(`Could not find symbol of name ${name}`);
	// 	}

	// 	return symbol;
	// }

	// public getTypeByName(name: keyof typeof SYMBOL_NAMES) {
	// 	return this.typeOfSymbol.get(name);
	// }

	// public names() {
	// 	return [...this.symbols.keys()];
	// }

	public resolveGlobalSymbol(provider: Provider, name: string) {
		return provider.typeChecker.resolveName(name, undefined, provider.ts.SymbolFlags.All, false);
	}
}
