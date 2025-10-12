import type ts from "typescript";
import { AirshipCompilerDiagnosticCode } from "../util/constants";
import { Provider } from "../util/provider";
import { getAirshipBehaviours } from "../util/airshipBehaviours";
import luau from "@roblox-ts/luau-ast";
import {
	getNetworkBoundaryOfFunction,
	getNetworkBoundaryOfMethod,
} from "./analysis/functions/getNetworkBoundaryOfMethod";
import { getContainingNetworkBoundaryOfNode } from "./analysis/functions/getContainingNetworkBoundaryOfNode";
import { NetworkBoundary } from "../util/boundary";
import { parseDirectives } from "./analysis/functions/parseDirectives";
import { identity } from "typescript";

interface ClarifiedDiagnostic {
	regex: RegExp;
	func: (diagnostic: ts.Diagnostic, match: RegExpExecArray) => void;
}

const CLARIFIED_DIAGNOSTICS: Array<ClarifiedDiagnostic> = [
	{
		regex: /Property '_nominal_(.*)' is missing in type '(.*)' but required in type '(.*)'./,
		func: (diagnostic, match) => {
			diagnostic.messageText = `Type '${match[2]}' is not assignable to nominal type '${match[1]}'`;
		},
	},
	{
		regex: /Type '(.*?)' is missing the following properties from type '(.*?)': .*?_nominal_(\2)/,
		func: (diagnostic, match) => {
			diagnostic.messageText = `Type '${match[1]}' is not assignable to nominal type '${match[2]}'`;
		},
	},
];

const luauKeywords = [
	"if",
	"else",
	"elseif",
	"for",
	"while",
	"break",
	"continue",
	"repeat",
	"until",
	"not",
	"then",
	"end",
	"function",
	"local",
	"or",
	"and",
	"do",
	"self",
];

const { game, script, ...globals } = luau.globals;

function isReservedIdentifier(id: string) {
	return Object.prototype.hasOwnProperty.call(globals, id);
}

const compilerIdentifiers = [
	"Server",
	"Client",
	"Header",
	"SerializeField",
	"NonSerialized",
	"Tooltip",
	"Min",
	"Max",
	"Multiline",
	"Spacing",
	"TextArea",
	"HideInInspector",
	"RequireComponent",
	"AirshipComponentMenu",
	"AirshipComponentIcon",
	"InspectorName",
	"Spacing",
	"ColorUsage",
];
function isShadowingCompilerDecorator(id: string) {
	return compilerIdentifiers.includes(id);
}

interface NetworkBoundaryInfo {
	readonly parent: NetworkBoundary;
	readonly parentNode?: ts.Node;
	readonly node: NetworkBoundary;
}

export interface AirshipCompilerDiagnostic extends ts.Diagnostic {
	readonly node?: ts.Node;
	readonly networkBoundary?: NetworkBoundaryInfo;
}

export function getSemanticDiagnosticsFactory(provider: Provider): ts.LanguageService["getSemanticDiagnostics"] {
	const { symbols, service, config, ts } = provider;
	// const symbols = new SymbolProvider(provider, provider.typeChecker);

	return (file) => {
		symbols.refresh(provider);

		const diagnostics = service.getSemanticDiagnostics(file);
		const sourceFile = provider.getSourceFile(file);

		function pushNodeDiagnostic(
			code: AirshipCompilerDiagnosticCode,
			node: ts.Node,
			messageText: string,
			category = ts.DiagnosticCategory.Error,
			data?: Omit<AirshipCompilerDiagnostic, keyof ts.Diagnostic | "node">,
		) {
			const startPos = node.getStart();
			const endPos = node.getEnd() - startPos;

			diagnostics.push(
				identity<AirshipCompilerDiagnostic>({
					category,
					file: sourceFile,
					messageText: messageText,
					start: startPos,
					code,
					length: endPos,
					node,
					...data,
				}),
			);
		}

		if (config.diagnosticsMode !== "off") {
			const airshipBehaviours = getAirshipBehaviours(provider, sourceFile);

			ts.forEachChildRecursively(sourceFile, (node) => {
				if (provider.config.showCompilerErrors) {
					// typeof
					if (ts.isTypeOfExpression(node)) {
						pushNodeDiagnostic(
							AirshipCompilerDiagnosticCode.NoTypeOfNode,
							node,
							`typeof operator is not supported - use typeOf or typeIs!`,
						);
					}

					if (ts.isPrivateIdentifier(node)) {
						pushNodeDiagnostic(
							AirshipCompilerDiagnosticCode.UnsupportedFeature,
							node,
							`private identifiers are not supported!`,
						);
					}

					if (ts.isBinaryExpression(node) && ts.isEqualityOperatorKind(node.operatorToken.kind)) {
						if (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken) {
							pushNodeDiagnostic(
								AirshipCompilerDiagnosticCode.InvalidEquality,
								node,
								`operator \`==\` is not supported! use \`===\``,
							);
						} else if (node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken) {
							pushNodeDiagnostic(
								AirshipCompilerDiagnosticCode.InvalidInverseEquality,
								node,
								`operator \`!=\` is not supported! use \`!==\``,
							);
						}
					}

					if (ts.isDebuggerStatement(node)) {
						pushNodeDiagnostic(
							AirshipCompilerDiagnosticCode.UnsupportedFeature,
							node,
							`debugger is not supported!`,
						);
					}

					if (node.kind === ts.SyntaxKind.NullKeyword) {
						pushNodeDiagnostic(
							AirshipCompilerDiagnosticCode.UnsupportedFeature,
							node,
							`\`null\` is not supported, use \`undefined\`!`,
						);
					}

					if (ts.isLabeledStatement(node)) {
						pushNodeDiagnostic(
							AirshipCompilerDiagnosticCode.UnsupportedFeature,
							node,
							`labels are not supported!`,
						);
					}

					if (ts.isVariableDeclaration(node) && ts.isVarUsing(node)) {
						pushNodeDiagnostic(
							AirshipCompilerDiagnosticCode.UnsupportedFeature,
							node.parent,
							`using declarations are not supported!`,
						);
					}

					if (ts.isExpression(node) && ts.isCommaExpression(node)) {
						pushNodeDiagnostic(
							AirshipCompilerDiagnosticCode.UnsupportedFeature,
							node,
							`operator \`,\` is not supported!`,
						);
					}

					if (ts.isPropertyAccessExpression(node)) {
						const typeAtLocation = provider.typeChecker.getSymbolAtLocation(node);
						if (
							typeAtLocation?.valueDeclaration &&
							ts.isMethodDeclaration(typeAtLocation.valueDeclaration) &&
							!ts.isCallExpression(node.parent)
						) {
							pushNodeDiagnostic(
								AirshipCompilerDiagnosticCode.IndexingMethodWithoutCalling,
								node,
								`Cannot index a method without calling it!`,
							);
						}
					}

					// Variables with invalid Luau keyword/identifier names
					if (ts.isVariableDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
						if (!luau.isValidIdentifier(node.name.text)) {
							pushNodeDiagnostic(
								AirshipCompilerDiagnosticCode.InvalidIdentifier,
								node.name,
								luauKeywords.includes(node.name.text)
									? `${node.name.text} is a Luau keyword and cannot be used as an identifier`
									: `${node.name.text} is not a valid identifier in Luau`,
							);
						} else if (isReservedIdentifier(node.name.text)) {
							pushNodeDiagnostic(
								AirshipCompilerDiagnosticCode.InvalidIdentifier,
								node.name,
								`${node.name.text} is a reserved global and cannot be used`,
							);
						}
					}

					/**
					 * Function declarations with invalid identifier names or Luau keywords
					 */
					if (ts.isFunctionDeclaration(node) && node.name) {
						if (isReservedIdentifier(node.name.text)) {
							pushNodeDiagnostic(
								AirshipCompilerDiagnosticCode.InvalidIdentifier,
								node.name,
								`${node.name.text} is a reserved global and cannot be used as a function name`,
							);
						} else if (isShadowingCompilerDecorator(node.name.text)) {
							pushNodeDiagnostic(
								AirshipCompilerDiagnosticCode.InvalidIdentifier,
								node.name,
								`${node.name.text} is a compiler macro identifier, and should not be used as a function name`,
								ts.DiagnosticCategory.Warning,
							);
						}
					}

					if (ts.isForInStatement(node)) {
						pushNodeDiagnostic(
							AirshipCompilerDiagnosticCode.ForInStatementUsage,
							node,
							`for-in loop statements are not supported!`,
						);
					}
				}

				if (provider.config.networkBoundaryCheck !== "off") {
					if (ts.isCallExpression(node) /* && isMethodCall(provider.typeChecker, node) */) {
						const symbol = provider.typeChecker.getSymbolAtLocation(node.expression);
						if (symbol?.valueDeclaration && ts.isMethodDeclaration(symbol.valueDeclaration)) {
							const callContext = getNetworkBoundaryOfMethod(provider, symbol.valueDeclaration);
							const parentBoundaryInfo = getContainingNetworkBoundaryOfNode(provider, node.expression);

							if (callContext !== NetworkBoundary.Shared && callContext !== parentBoundaryInfo.boundary) {
								pushNodeDiagnostic(
									AirshipCompilerDiagnosticCode.NetworkBoundaryMismatch,
									node,
									`Method ${symbol.valueDeclaration.name.getText()} is marked ${callContext}-only, however is being called in ${
										parentBoundaryInfo.boundary
									} context.`,
									ts.DiagnosticCategory.Warning,
									{
										networkBoundary: {
											node: callContext,
											parent: parentBoundaryInfo.boundary,
											parentNode: parentBoundaryInfo.boundaryNode,
										},
									},
								);
							}
						}
						if (
							symbol?.valueDeclaration &&
							ts.isFunctionDeclaration(symbol.valueDeclaration) &&
							symbol.valueDeclaration.name
						) {
							const callContext = getNetworkBoundaryOfFunction(provider, symbol.valueDeclaration);
							const parentBoundaryInfo = getContainingNetworkBoundaryOfNode(provider, node.expression);

							if (callContext !== NetworkBoundary.Shared && callContext !== parentBoundaryInfo.boundary) {
								pushNodeDiagnostic(
									AirshipCompilerDiagnosticCode.NetworkBoundaryMismatch,
									node,
									`Function ${symbol.valueDeclaration.name.getText()} is marked ${callContext}-only, however is being called in ${
										parentBoundaryInfo.boundary
									} context.`,
									ts.DiagnosticCategory.Warning,
									{
										networkBoundary: {
											node: callContext,
											parent: parentBoundaryInfo.boundary,
											parentNode: parentBoundaryInfo.boundaryNode,
										},
									},
								);
							}
						}
					}

					if (ts.isIfStatement(node)) {
						const hasDirectives = parseDirectives(provider, node.expression, true, true);
						if (hasDirectives !== undefined) {
							const containingBoundaryInfo = getContainingNetworkBoundaryOfNode(provider, node);
							const ifBoundary = hasDirectives.isServer
								? NetworkBoundary.Server
								: hasDirectives.isClient
								? NetworkBoundary.Client
								: NetworkBoundary.Shared;

							if (
								containingBoundaryInfo.boundary !== NetworkBoundary.Shared &&
								containingBoundaryInfo.boundary !== ifBoundary
							) {
								pushNodeDiagnostic(
									AirshipCompilerDiagnosticCode.NetworkBoundaryMismatch,
									node,
									`Statement is marked ${ifBoundary}-only, but will never run due to being inside a ${containingBoundaryInfo.boundary}-only boundary`,
									ts.DiagnosticCategory.Warning,
									{
										networkBoundary: {
											node: ifBoundary,
											parent: containingBoundaryInfo.boundary,
											parentNode: containingBoundaryInfo.boundaryNode,
										},
									},
								);
							}
						}
					}
				}
			});

			airshipBehaviours.forEach(($behaviour) => {
				for (const member of $behaviour.node.members) {
					if (ts.isConstructorDeclaration(member)) {
						const startPos = member.name?.getStart() ?? member.getStart();
						const endPos = (member.name?.getEnd() ?? member.getEnd()) - startPos;

						diagnostics.push({
							category: ts.DiagnosticCategory.Warning,
							code: AirshipCompilerDiagnosticCode.AirshipBehaviourWarning,
							file: sourceFile,
							messageText:
								"An AirshipBehaviour should not have a constructor, you should instead use the Awake() lifecycle method",
							start: startPos,
							length: endPos,
						});
					}
				}
			});

			airshipBehaviours
				.filter((behaviour) => {
					const declaration = behaviour.node;
					return (
						declaration.modifiers === undefined ||
						!declaration.modifiers.find(
							(modifier) =>
								ts.isAbstractModifier(modifier) || modifier.kind === ts.SyntaxKind.DefaultKeyword,
						)
					);
				})
				.forEach(($behaviour) => {
					const name = $behaviour.name;
					const classDeclaration = $behaviour.node;
					const nameNode = $behaviour.node.name;

					const startPos = nameNode?.getStart() ?? classDeclaration.getStart();
					const endPos = nameNode?.getEnd() ?? classDeclaration.getEnd();

					diagnostics.push({
						category: ts.DiagnosticCategory.Error,
						code: AirshipCompilerDiagnosticCode.InvalidAirshipBehaviourDeclaration,
						file: sourceFile,
						messageText: `AirshipBehaviour '${name}' must have a default or abstract modifier`,
						start: startPos,
						length: endPos - startPos,
					});
				});

			diagnostics.forEach((diagnostic) => {
				if (typeof diagnostic.messageText === "string") {
					for (const clarifiedDiagnostic of CLARIFIED_DIAGNOSTICS) {
						const match = clarifiedDiagnostic.regex.exec(diagnostic.messageText);
						if (match) {
							clarifiedDiagnostic.func(diagnostic, match);
							break;
						}
					}
				}
			});
		}

		return diagnostics;
	};
}
