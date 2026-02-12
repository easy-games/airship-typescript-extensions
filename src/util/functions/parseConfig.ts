import * as z from "zod";

/**
 * The plugin's configuration.
 */
export interface PluginConfig {
	showCompilerErrors: boolean;
	networkBoundaryCheck: "off" | "warning";
	hideDeprecated: boolean;
	diagnosticsMode: "off" | "warning" | "error" | "message";
	networkBoundaryInfo: boolean;
	layers: string[];
	useGameConfig: boolean;
}

/**
 * Zod schema for configuration.
 */
const CONFIG_SCHEMA = z
	.object({
		showCompilerErrors: z.boolean(),
		hideDeprecated: z.boolean(),
		diagnosticsMode: z.enum(["off", "warning", "error", "message"]),
		networkBoundaryCheck: z.enum(["off", "warning"]),
		networkBoundaryInfo: z.boolean(),
	})
	.nonstrict()
	.partial();

/**
 * Get the PluginConfig with sanity checks and default values.
 * @param config The config directly from the plugin.
 */
export function parseConfig(unsafeConfig: Partial<PluginConfig>): PluginConfig {
	const parsedConfig = CONFIG_SCHEMA.safeParse(unsafeConfig);
	const config = parsedConfig.success ? parsedConfig.data : {};
	return {
		showCompilerErrors: config.showCompilerErrors ?? true,
		networkBoundaryCheck: config.networkBoundaryCheck ?? "warning",
		networkBoundaryInfo: config.networkBoundaryInfo ?? true,
		hideDeprecated: config.hideDeprecated ?? false,
		diagnosticsMode: config.diagnosticsMode ?? "warning",
		layers: [],
		useGameConfig: false,
	};
}
