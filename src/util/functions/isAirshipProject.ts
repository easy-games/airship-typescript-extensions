import type tslib from "typescript";
import fs from "fs";
import { PluginCreateInfo } from "../../types";
import path from "path";

/**
 * Checks if this project is a roblox-ts project.
 */
export function isAirshipProject(ts: typeof tslib, info: PluginCreateInfo) {
	const typescriptDir = path.join(info.project.getCurrentDirectory(), "Typescript~");

	if (!fs.existsSync(typescriptDir)) return false;

	const pkg = ts.findPackageJson(typescriptDir, info.languageServiceHost);
	if (!pkg) return false;

	// const contents = fs.readFileSync(pkg, { encoding: "ascii" });
	// const packageJson = JSON.parse(contents);
	// if (!packageJson) return false;

	// const devDependencies = packageJson.devDependencies;
	// if (typeof devDependencies === "object" && devDependencies["@easy-games/unity-ts"]) return true;

	// const dependencies = packageJson.dependencies;
	// if (typeof dependencies === "object" && dependencies["@easy-games/unity-ts"]) return true;

	return true;
}
