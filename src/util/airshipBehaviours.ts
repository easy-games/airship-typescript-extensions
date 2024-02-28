/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type ts from "typescript";
import { Provider } from "./provider";

interface AirshipBehaviour {
	readonly name: string;
	readonly start: number;
	readonly end: number;
	readonly node: ts.ClassDeclaration;
}

function getAncestorTypeSymbols(nodeType: ts.Type) {
	// ensure non-nullable (e.g. if `GameObject | undefined` - make `GameObject`)
	if (nodeType.isNullableType()) {
		nodeType = nodeType.getNonNullableType();
	}

	const baseTypes = nodeType.getBaseTypes();
	if (baseTypes) {
		const symbols = new Array<ts.Symbol>();
		for (const baseType of baseTypes) {
			symbols.push(baseType.symbol);

			for (const parentSymbol of getAncestorTypeSymbols(baseType)) {
				symbols.push(parentSymbol);
			}
		}
		return symbols;
	} else {
		return [];
	}
}

function getExtendsNode(provider: Provider, node: ts.ClassLikeDeclaration) {
	const { ts } = provider;
	for (const clause of node.heritageClauses ?? []) {
		if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
			return clause.types[0];
		}
	}
}

function getOriginalSymbolOfNode(provider: Provider, node: ts.Node) {
	const { ts, typeChecker } = provider;

	const symbol = typeChecker.getSymbolAtLocation(node);
	if (symbol) {
		return ts.skipAlias(symbol, typeChecker);
	}
	return symbol;
}

function isAirshipBehaviour(provider: Provider, declaration: ts.ClassDeclaration): boolean {
	const extendsNode = getExtendsNode(provider, declaration);
	if (!extendsNode) return false;
	if (!declaration.name) return false;

	const airshipBehaviourSymbol = provider.getSymbolNamed("AirshipBehaviour");
	const classExtendsSymbol = getOriginalSymbolOfNode(provider, extendsNode.expression);
	if (classExtendsSymbol === airshipBehaviourSymbol) {
		return true;
	}

	const type = provider.typeChecker.getTypeAtLocation(declaration);

	// Get the inheritance tree, otherwise
	const inheritance = getAncestorTypeSymbols(type);
	if (inheritance.length === 0) {
		return false;
	}

	// Get the root inheriting symbol (Should match AirshipBehaviour for this to be "extending" AirshipBehaviour)
	const baseTypeDeclaration = inheritance[inheritance.length - 1];
	if (baseTypeDeclaration !== undefined) {
		return baseTypeDeclaration === airshipBehaviourSymbol;
	}

	return false;
}

export function findAirshipBehaviour(
	provider: Provider,
	sourceFile: ts.SourceFile,
	pos: number,
): AirshipBehaviour | undefined {
	const { ts } = provider;
	const node = ts.getTokenAtPosition(sourceFile, pos);
	const classDeclaration = ts.findAncestor(node, (decl): decl is ts.ClassDeclaration => ts.isClassDeclaration(decl));
	if (classDeclaration && isAirshipBehaviour(provider, classDeclaration)) {
		return {
			start: classDeclaration.getStart(),
			end: classDeclaration.getEnd(),
			name: classDeclaration.name!.text,
			node: classDeclaration,
		};
	}
}

export function getAirshipBehaviours(provider: Provider, sourceFile: ts.SourceFile): AirshipBehaviour[] {
	const { ts } = provider;
	// TODO

	const behaviours = new Array<AirshipBehaviour>();

	for (const statement of sourceFile.statements) {
		if (ts.isClassDeclaration(statement) && isAirshipBehaviour(provider, statement)) {
			behaviours.push({
				start: statement.getStart(),
				end: statement.getEnd(),
				name: statement.name!.text,
				node: statement,
			});
		}
	}

	return behaviours;
}
