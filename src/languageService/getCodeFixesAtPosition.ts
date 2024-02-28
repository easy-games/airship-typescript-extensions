import type ts from "typescript";
import { AIRSHIP_BEHAVIOUR_DECLARATION_DIAGNOSTIC_CODE, BOUNDARY_DIAGNOSTIC_CODE } from "../util/constants";
import { findImport } from "../util/imports";
import { Provider } from "../util/provider";
import { findAirshipBehaviour, getAirshipBehaviours } from "../util/airshipBehaviours";

export function getCodeFixesAtPositionFactory(provider: Provider): ts.LanguageService["getCodeFixesAtPosition"] {
	const { service, serviceProxy, ts } = provider;
	return (file, start, end, codes, formatOptions, preferences) => {
		let orig = service.getCodeFixesAtPosition(file, start, end, codes, formatOptions, preferences);

		// const semanticDiagnostics = serviceProxy
		// 	.getSemanticDiagnostics(file)
		// 	.filter((x) => x.code === BOUNDARY_DIAGNOSTIC_CODE);
		// semanticDiagnostics.forEach((diag) => {
		// 	if (diag.start !== undefined && diag.length !== undefined) {
		// 		if (start >= diag.start && end <= diag.start + diag.length) {
		// 			const sourceFile = provider.getSourceFile(file);
		// 			const $import = findImport(provider, sourceFile, diag.start);
		// 			if ($import) {
		// 				orig = [
		// 					{
		// 						fixName: "crossBoundaryImport",
		// 						fixAllDescription: "Make all cross-boundary imports type only",
		// 						description: "Make cross-boundary import type only.",
		// 						changes: [
		// 							{
		// 								fileName: file,
		// 								textChanges: [
		// 									{
		// 										newText: "import type",
		// 										span: ts.createTextSpan($import.start, 6),
		// 									},
		// 								],
		// 							},
		// 						],
		// 					},
		// 					...orig,
		// 				];
		// 			}
		// 		}
		// 	}
		// });

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
