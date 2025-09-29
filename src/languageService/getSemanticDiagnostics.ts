import type ts from "typescript";
import { AIRSHIP_BEHAVIOUR_DECLARATION_DIAGNOSTIC_CODE, INVALID_ID_CODE } from "../util/constants";
import { Provider } from "../util/provider";
import { getAirshipBehaviours } from "../util/airshipBehaviours";
import { SymbolProvider } from "util/symbols";
import luau from "@roblox-ts/luau-ast";

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

export function getSemanticDiagnosticsFactory(provider: Provider): ts.LanguageService["getSemanticDiagnostics"] {
	const { service, config, ts } = provider;
	// const symbols = new SymbolProvider(provider, provider.typeChecker);

	return (file) => {
		const diagnostics = service.getSemanticDiagnostics(file);
		if (config.diagnosticsMode !== "off") {
			const sourceFile = provider.getSourceFile(file);
			const airshipBehaviours = getAirshipBehaviours(provider, sourceFile);

			ts.forEachChildRecursively(sourceFile, (node) => {
				if (ts.isVariableDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
					if (!luau.isValidIdentifier(node.name.text)) {
						const startPos = node.name.getStart();
						const endPos = node.name.getEnd() - startPos;

						diagnostics.push({
							category: ts.DiagnosticCategory.Error,
							file: sourceFile,
							messageText: luauKeywords.includes(node.name.text)
								? `${node.name.text} is a Luau keyword and cannot be used as an identifier`
								: `${node.name.text} is not a valid identifier in Luau`,
							start: startPos,
							code: INVALID_ID_CODE,
							length: endPos,
						});
					} else if (isReservedIdentifier(node.name.text)) {
						const startPos = node.name.getStart();
						const endPos = node.name.getEnd() - startPos;

						diagnostics.push({
							category: ts.DiagnosticCategory.Error,
							file: sourceFile,
							messageText: `${node.name.text} is a reserved global and cannot be used`,
							start: startPos,
							code: INVALID_ID_CODE,
							length: endPos,
						});
					}
				}

				if (ts.isFunctionDeclaration(node) && node.name) {
					if (isReservedIdentifier(node.name.text)) {
						const startPos = node.name.getStart();
						const endPos = node.name.getEnd() - startPos;

						diagnostics.push({
							category: ts.DiagnosticCategory.Error,
							file: sourceFile,
							messageText: `${node.name.text} is a reserved global and cannot be used as a function name`,
							start: startPos,
							code: INVALID_ID_CODE,
							length: endPos,
						});
					} else if (isShadowingCompilerDecorator(node.name.text)) {
						const startPos = node.name.getStart();
						const endPos = node.name.getEnd() - startPos;

						diagnostics.push({
							category: ts.DiagnosticCategory.Warning,
							file: sourceFile,
							messageText: `${node.name.text} is a compiler macro identifier, and should not be used as a function name`,
							start: startPos,
							code: INVALID_ID_CODE,
							length: endPos,
						});
					}
				}

				// if (ts.isPropertyAccessExpression(node)) {
				// 	const typeAtLocation = provider.typeChecker.getTypeAtLocation(node);
				// 	const symbolAtLocation = provider.typeChecker.getSymbolAtLocation(node.parent);
				// 	const transformSymbol = provider.symbols.getSymbolByName("Transform");

				// 	if (typeAtLocation !== undefined) {
				// 		const startPos = node.getStart();
				// 		const endPos = node.getEnd() - startPos;

				// 		if (typeAtLocation.symbol === transformSymbol && ts.isPropertyAccessExpression(node.parent)) {
				// 			diagnostics.push({
				// 				category: ts.DiagnosticCategory.Warning,
				// 				file: sourceFile,
				// 				messageText: `Transform accesses should be cached as a variable. :: Symbol ${
				// 					symbolAtLocation?.id ?? -1
				// 				}`,
				// 				start: startPos,
				// 				code: 1000000,
				// 				length: endPos,
				// 			});
				// 		}
				// 	}
				// }
			});

			airshipBehaviours.forEach(($behaviour) => {
				for (const member of $behaviour.node.members) {
					if (ts.isConstructorDeclaration(member)) {
						const startPos = member.name?.getStart() ?? member.getStart();
						const endPos = (member.name?.getEnd() ?? member.getEnd()) - startPos;

						diagnostics.push({
							category: ts.DiagnosticCategory.Warning,
							code: AIRSHIP_BEHAVIOUR_DECLARATION_DIAGNOSTIC_CODE + 1,
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
						code: AIRSHIP_BEHAVIOUR_DECLARATION_DIAGNOSTIC_CODE,
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
