import { copyFileSync, mkdirSync } from "node:fs";
import { SolidPlugin } from "@dschz/bun-plugin-solid";

mkdirSync("build/main-ui", { recursive: true });

const result = await Bun.build({
	entrypoints: ["src/main-ui/index.ts"],
	outdir: "build/main-ui",
	target: "browser",
	plugins: [
		SolidPlugin({
			generate: "dom",
			hydratable: false,
		}),
	],
});

if (!result.success) {
	for (const _msg of result.logs) {
	}
	process.exit(1);
}

copyFileSync("../../libs/core.ui/build/styles.css", "build/main-ui/styles.css");
console.info("View built successfully");
