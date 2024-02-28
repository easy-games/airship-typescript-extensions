import type tslib from "typescript";
import fs from "fs";
import { PluginCreateInfo } from "../../types";

/**
 * Checks if this project is a roblox-ts project.
 */
export function isAirshipProject(ts: typeof tslib, info: PluginCreateInfo) {
	const pkg = ts.findPackageJson(info.project.getCurrentDirectory(), info.languageServiceHost);
	if (!pkg) return false;

	const contents = fs.readFileSync(pkg, { encoding: "ascii" });
	const packageJson = JSON.parse(contents);
	if (!packageJson) return false;

	const devDependencies = packageJson.devDependencies;
	if (typeof devDependencies === "object" && devDependencies["@easy-games/unity-ts"]) return true;

	const dependencies = packageJson.dependencies;
	if (typeof dependencies === "object" && dependencies["@easy-games/unity-ts"]) return true;

	return false;
}
