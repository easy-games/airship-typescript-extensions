import ts from "typescript";
import { Provider } from "./provider";

const SYMBOL_NAMES = {
	Object: "Object",
	GameObject: "GameObject",
	Component: "Component",
	Transform: "Transform",
};

function getGlobalSymbolByNameOrThrow(typeChecker: ts.TypeChecker, name: string, meaning: ts.SymbolFlags) {
	const symbol = typeChecker.resolveName(name, undefined, meaning, false);
	if (symbol) {
		return symbol;
	}

	throw new Error(`The types for symbol '${name}' could not be found`);
}

export class SymbolProvider {
	private symbols = new Map<string, ts.Symbol>();
	private typeOfSymbol = new Map<string, ts.Type>();

	private initialized = false;

	public constructor(private readonly provider: Provider) {}

	public update() {
		// if (this.initialized) return;

		// for (const symbolName of Object.values(SYMBOL_NAMES)) {
		// 	const symbol = this.typeChecker.resolveName(symbolName, undefined, ts.SymbolFlags.All, false);
		// 	if (symbol) {
		// 		this.symbols.set(symbolName, symbol);
		// 		// this.typeOfSymbol.set(symbolName, this.typeChecker.getTypeOfSymbol(symbol));
		// 	} else {
		// 		this.provider.pushDiagnostic(`The types for symbol '${symbolName}' could not be found`);
		// 	}
		// }

		const transformSymbol = this.provider.typeChecker.resolveName(
			"Transform",
			undefined,
			ts.SymbolFlags.All,
			false,
		);
		if (transformSymbol) this.symbols.set("Transform", transformSymbol);

		// this.initialized = true;
	}

	public getSymbolByName(name: keyof typeof SYMBOL_NAMES) {
		const symbol = this.symbols.get(name);

		if (!symbol) {
			this.provider.pushDiagnostic(`Could not find symbol of name ${name}`);
		}

		return symbol;
	}

	public getTypeByName(name: keyof typeof SYMBOL_NAMES) {
		return this.typeOfSymbol.get(name);
	}

	public names() {
		return [...this.symbols.keys()];
	}
}
