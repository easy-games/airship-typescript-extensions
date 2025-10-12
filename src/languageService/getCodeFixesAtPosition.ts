import type ts from "typescript";
import { AIRSHIP_BEHAVIOUR_DECLARATION_DIAGNOSTIC_CODE, AirshipCompilerDiagnosticCode } from "../util/constants";
import { Provider } from "../util/provider";
import { findAirshipBehaviour } from "../util/airshipBehaviours";
import { AirshipCompilerDiagnostic } from "./getSemanticDiagnostics";
import { NetworkBoundary } from "../util/boundary";
import { findAncestorNode } from "./analysis/functions/getContainingNetworkBoundaryOfNode";
import { createPrinter, factory } from "typescript";

export function getCodeFixesAtPositionFactory(provider: Provider): ts.LanguageService["getCodeFixesAtPosition"] {
	const { service, serviceProxy, ts } = provider;

	return (file, start, end, codes, formatOptions, preferences) => {
		let orig = [...service.getCodeFixesAtPosition(file, start, end, codes, formatOptions, preferences)];

		serviceProxy.getSemanticDiagnostics(file).forEach((diagnostic) => {
			if (diagnostic.start === undefined || diagnostic.length === undefined) return;
			if (start < diagnostic.start || end > diagnostic.start + diagnostic.length) return;

			const airshipDiagnostic = diagnostic as AirshipCompilerDiagnostic;

			if (diagnostic.code === AirshipCompilerDiagnosticCode.ForInStatementUsage) {
				if (airshipDiagnostic.node && ts.isForInStatement(airshipDiagnostic.node)) {
					const node = airshipDiagnostic.node;
					const { initializer, expression } = node;

					const expressionType = provider.typeChecker.getTypeAtLocation(expression);

					if (provider.typeChecker.isArrayLikeType(expressionType)) {
						orig.push({
							fixName: "toForOfLoopValueIter",
							description: "To for-of array iterator",
							changes: [
								{
									fileName: file,
									textChanges: [
										{
											newText: `${initializer.getText()} of ${expression.getText()}`,
											span: ts.createTextSpan(
												initializer.getStart(),
												expression.getEnd() - initializer.getStart(),
											),
										},
									],
								},
							],
						});
					} else {
						orig.push({
							fixName: "toForOfLoopkeys",
							description: "To for-of key iterator",
							changes: [
								{
									fileName: file,
									textChanges: [
										{
											newText: `const [key] of pairs(${expression.getText()})`,
											span: ts.createTextSpan(
												initializer.getStart(),
												expression.getEnd() - initializer.getStart(),
											),
										},
									],
								},
							],
						});
					}
				}
			}

			if (diagnostic.code === AirshipCompilerDiagnosticCode.NoTypeOfNode) {
				const typeOfNode = airshipDiagnostic.node as ts.TypeOfExpression;

				orig.push({
					fixName: "convertToTypeOf",
					description: "Convert to typeOf check",
					changes: [
						{
							fileName: file,
							textChanges: [
								{
									newText: `typeOf(${typeOfNode.expression.getText()})`,
									span: ts.createTextSpan(
										typeOfNode.getStart(),
										typeOfNode.getEnd() - typeOfNode.getStart(),
									),
								},
							],
						},
					],
				});
			}

			if (
				diagnostic.code === AirshipCompilerDiagnosticCode.NetworkBoundaryMismatch &&
				airshipDiagnostic.networkBoundary
			) {
				const node = airshipDiagnostic.node as ts.IfStatement | ts.CallExpression;
				const {
					node: nodeBoundary,
					parent: parentBoundary,
					parentNode: parentBoundaryNode,
				} = airshipDiagnostic.networkBoundary;

				if (
					parentBoundaryNode &&
					ts.isMethodDeclaration(parentBoundaryNode) &&
					parentBoundary === NetworkBoundary.Shared
				) {
					const span = ts.createTextSpan(parentBoundaryNode.getStart(), 0);

					const expr =
						nodeBoundary === NetworkBoundary.Server
							? "Server"
							: nodeBoundary === NetworkBoundary.Client
							? "Client"
							: "false";

					orig.push({
						fixName: "fixBoundaryMethod",
						description: `Set method '${parentBoundaryNode.name.getText()}' to ${expr}-only`,
						changes: [
							{
								fileName: file,
								textChanges: [
									{
										newText: `@${expr}() `,
										span,
									},
								],
							},
						],
					});
				}

				const contextLabel =
					nodeBoundary === NetworkBoundary.Server
						? "Server"
						: nodeBoundary === NetworkBoundary.Client
						? "Client"
						: undefined;

				if (!contextLabel) return;

				if (parentBoundary === NetworkBoundary.Shared) {
					const span = ts.createTextSpan(node.getStart(), 0);

					const expressionStatement = findAncestorNode(
						node,
						ts.isExpressionStatement,
						(cNode) =>
							ts.isCallExpression(cNode) ||
							ts.isConditionalExpression(node) ||
							(ts.isIfStatement(cNode) &&
								(cNode.expression === node || node.expression.getChildren().includes(node))), // no nesting inside if statements
					);
					if (contextLabel && expressionStatement) {
						orig.push({
							fixName: "fixBoundaryWithDirectiveWrap",
							description: `Add ${contextLabel} check before statement`,
							changes: [
								{
									fileName: file,
									textChanges: [
										{
											newText: `if ($${contextLabel.toUpperCase()}) `,
											span,
										},
									],
								},
							],
						});
					}

					if (ts.isCallExpression(node)) {
						const parentVariableDeclaration = findAncestorNode(
							node,
							(node) => ts.isVariableDeclaration(node) || ts.isCallExpression(node),
							(cNode) => ts.isExpressionStatement(cNode),
						);

						const callType = provider.typeChecker.getResolvedSignature(node);

						if (parentVariableDeclaration && contextLabel && callType) {
							const returnType = callType.getReturnType();
							if (returnType.isNullableType()) {
								const span = ts.createTextSpan(node.getStart(), node.getEnd() - node.getStart());

								const printer = createPrinter({});
								const conditionExpression = factory.createConditionalExpression(
									factory.createIdentifier(`$${contextLabel.toUpperCase()}`),
									factory.createToken(ts.SyntaxKind.QuestionToken),
									node,
									factory.createToken(ts.SyntaxKind.ColonToken),
									factory.createIdentifier("undefined"),
								);

								orig.push({
									fixName: "fixWithConditionalExpression",
									description: `Wrap in ${contextLabel} conditional expression`,
									changes: [
										{
											fileName: file,
											textChanges: [
												{
													newText: printer.printNode(
														ts.EmitHint.Expression,
														conditionExpression,
														conditionExpression.getSourceFile(),
													),
													span,
												},
											],
										},
									],
								});
							}
						} else {
							const ifStatement = findAncestorNode(node, ts.isIfStatement, ts.isBinaryExpression);
							if (ifStatement && contextLabel) {
								const span = ts.createTextSpan(node.getStart(), node.getEnd() - node.getStart());

								const printer = createPrinter({});
								const condition = factory.createBinaryExpression(
									factory.createIdentifier(`$${contextLabel.toUpperCase()}`),
									ts.SyntaxKind.AmpersandAmpersandToken,
									node,
								);

								orig.push({
									fixName: "fixWithIfDirectiveCheck",
									description: `Add ${contextLabel} check to if statement`,
									changes: [
										{
											fileName: file,
											textChanges: [
												{
													newText: printer.printNode(
														ts.EmitHint.Expression,
														condition,
														condition.getSourceFile(),
													),
													span,
												},
											],
										},
									],
								});
							}
						}
					}
				}
			}
		});

		serviceProxy
			.getSemanticDiagnostics(file)
			.filter((x) => x.code === AIRSHIP_BEHAVIOUR_DECLARATION_DIAGNOSTIC_CODE)
			.forEach((diagnostic) => {
				if (diagnostic.start !== undefined && diagnostic.length !== undefined) {
					if (start >= diagnostic.start && end <= diagnostic.start + diagnostic.length) {
						const sourceFile = provider.getSourceFile(file);
						const behaviour = findAirshipBehaviour(provider, sourceFile, diagnostic.start);
						if (behaviour) {
							orig = [
								{
									fixName: "exportAsComponent",
									fixAllDescription: "Mark all AirshipBehaviours as component (export default)",
									description: "Use AirshipBehaviour as component (export default)",
									changes: [
										{
											fileName: file,
											textChanges: [
												{
													newText: "export default",
													span: ts.createTextSpan(behaviour.start, 6),
												},
											],
										},
									],
								},
								{
									fixName: "exportAsAbstract",
									description: "Use AirshipBehaviour as base component logic (export abstract)",
									changes: [
										{
											fileName: file,
											textChanges: [
												{
													newText: "export abstract",
													span: ts.createTextSpan(behaviour.start, 6),
												},
											],
										},
									],
								},
								...orig,
							];
						}
					}
				}
			});

		return orig;
	};
}
