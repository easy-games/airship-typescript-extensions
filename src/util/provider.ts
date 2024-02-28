import type ts from "typescript";
import { createConstants } from "./constants";
import { expect } from "./functions/expect";
import { PluginCreateInfo } from "../types";
import { NetworkBoundary } from "./boundary";

export class Provider {
	public constants = createConstants(this.info);
	public ts: typeof ts;

	public currentDirectory = this.constants.currentDirectory;
	public projectService = this.info.project.projectService;
	public pathTranslator = this.constants.pathTranslator;
	public logger = this.projectService.logger;
	public srcDir = this.constants.srcDir;
	public config = this.constants.config;

	public boundaryCache = new Map<string, NetworkBoundary>();

	constructor(
		public serviceProxy: ts.LanguageService,
		public service: ts.LanguageService,
		public info: PluginCreateInfo,
		tsImpl: typeof ts,
	) {
		this.ts = tsImpl;
	}

	get program() {
		return expect(this.service.getProgram(), "getProgram");
	}

	get typeChecker() {
		return this.program.getTypeChecker();
	}

	getSymbolNamed(name: string) {
		return this.typeChecker.resolveName(name, undefined, this.ts.SymbolFlags.All, false);
	}

	getSymbol(node: ts.Node) {
		const symbol = this.typeChecker.getSymbolAtLocation(node);
		if (!symbol) return;

		return this.ts.skipAlias(symbol, this.typeChecker);
	}

	/**
	 * Log values to the console, all non-strings will be stringified.
	 * @param args The values to be logged.
	 */
	log(...args: unknown[]) {
		const stringArgs = new Array<string>();
		for (const arg of args) {
			stringArgs.push(typeof arg === "string" ? arg : JSON.stringify(arg));
		}
		this.logger.info(stringArgs.join(", "));
		return stringArgs;
	}

	/**
	 * Gets the source file for a file.
	 * @param file The file path
	 */
	getSourceFile(file: string): ts.SourceFile {
		return expect(this.program.getSourceFile(file), "getSourceFile");
	}
}
