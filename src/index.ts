/**
 * Language service plugin
 */

"use strict";

import {} from "ts-expose-internals";
import * as ts from "typescript";
import { createProxy } from "./util/functions/createProxy";
import { Provider } from "./util/provider";
import { AIRSHIP_BEHAVIOUR_DECLARATION_DIAGNOSTIC_CODE, BOUNDARY_DIAGNOSTIC_CODE } from "./util/constants";
import { PluginCreateInfo } from "./types";
import { getCompletionsAtPositionFactory } from "./languageService/getCompletionsAtPosition";
import { getSemanticDiagnosticsFactory } from "./languageService/getSemanticDiagnostics";
import { getCodeFixesAtPositionFactory } from "./languageService/getCodeFixesAtPosition";
import { getCompletionEntryDetailsFactory } from "./languageService/getCompletionEntryDetails";
import { isAirshipProject } from "./util/functions/isAirshipProject";

const AIRSHIP_MARKER = "_airship_marker_service";

export = function init(modules: { typescript: typeof ts }) {
	const ts = modules.typescript;
	let provider: Provider;
	function create(info: PluginCreateInfo) {
		const service = info.languageService;
		if (!isAirshipProject(ts, info)) {
			// This project does not depend on @rbxts/compiler-types, so skip instantiation.
			console.log("airship-typescript-extensions skipped due to not being Airship project");
			return service;
		}

		if (AIRSHIP_MARKER in service) {
			console.log("TypeScript attempted to double inject airship-typescript-extensions");
			return service;
		}

		const serviceProxy = createProxy(service);
		provider = new Provider(serviceProxy, service, info, ts);

		serviceProxy["getSemanticDiagnostics"] = getSemanticDiagnosticsFactory(provider);
		serviceProxy["getCodeFixesAtPosition"] = getCodeFixesAtPositionFactory(provider);
		serviceProxy["getCompletionsAtPosition"] = getCompletionsAtPositionFactory(provider);
		serviceProxy["getCompletionEntryDetails"] = getCompletionEntryDetailsFactory(provider);

		// Register the codefix.
		ts.codefix.registerCodeFix({
			errorCodes: [BOUNDARY_DIAGNOSTIC_CODE, AIRSHIP_BEHAVIOUR_DECLARATION_DIAGNOSTIC_CODE],
			getCodeActions: () => undefined,
		});

		// If roblox-ts-extensions fails, this code will fallback to the original method.
		// If this isn't a roblox-ts project, this code will fallback to the original method.
		for (const key in serviceProxy) {
			const method = (serviceProxy as any)[key];
			const originalMethod = (service as any)[key];
			if (method && originalMethod) {
				(serviceProxy as any)[key] = function () {
					try {
						return method.apply(service, arguments);
					} catch (err) {
						if (err instanceof Error) {
							console.error(`[unity-ts error] ${key}`, `${err.stack ?? err.message}`);
						}
					}
					return originalMethod.apply(service, arguments);
				};
			}
		}

		// Add any unimplemented default methods.
		serviceProxy.addProxyMethods();
		serviceProxy[AIRSHIP_MARKER as never] = (() => void 0) as never;

		provider.log("Airship language extensions has loaded.");
		return serviceProxy;
	}

	function onConfigurationChanged(config: any) {
		if (provider) {
			Object.assign(provider.config, config);

			provider.boundaryCache.clear();
		}
	}

	return { create, onConfigurationChanged };
};
