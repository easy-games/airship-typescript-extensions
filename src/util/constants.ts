import { parseConfig } from "./functions/parseConfig";
import { PathTranslator } from "../project/PathTranslator";
import { PluginCreateInfo } from "../types";

export function createConstants(info: PluginCreateInfo) {
	const currentDirectory = info.languageServiceHost.getCurrentDirectory();
	const compilerOptions = info.project.getCompilerOptions();
	const formatOptions = info.project.projectService.getHostFormatCodeOptions();
	const userPreferences = info.project.projectService.getHostPreferences();
	const outDir = compilerOptions.outDir ?? currentDirectory;
	const srcDir = compilerOptions.rootDir ?? currentDirectory;
	const pathTranslator = new PathTranslator(srcDir, outDir, undefined, false);
	const config = parseConfig(info.config);

	return {
		config,
		currentDirectory,
		compilerOptions,
		userPreferences,
		pathTranslator,
		formatOptions,
		outDir,
		srcDir,
	};
}

export const BOUNDARY_DIAGNOSTIC_CODE = AirshipCompilerDiagnosticCode.InvalidNetworkBoundary;
export const AIRSHIP_BEHAVIOUR_DECLARATION_DIAGNOSTIC_CODE =
	AirshipCompilerDiagnosticCode.InvalidAirshipBehaviourDeclaration;

export const enum AirshipCompilerDiagnosticCode {
	InvalidNetworkBoundary = 1800000,
	InvalidAirshipBehaviourDeclaration,
	AirshipBehaviourWarning,
	InvalidIdentifier,
	ForInStatementUsage,
	NoTypeOfNode,
	IndexingMethodWithoutCalling,
	UnsupportedFeature,
	InvalidEquality,
	InvalidInverseEquality,
	NetworkBoundaryMismatch,
}

export type Constants = ReturnType<typeof createConstants>;
