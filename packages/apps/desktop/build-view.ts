import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

// Combine core.ui styles + dockview CSS + theme overrides
const coreStyles = readFileSync("../../libs/core.ui.design/build/styles.css", "utf8");
const dockviewCss = readFileSync(
	"../../../node_modules/dockview-core/dist/styles/dockview.css",
	"utf8",
);
const overrides = readFileSync("src/main-ui/dockview-overrides.css", "utf8");
writeFileSync("build/main-ui/styles.css", `${coreStyles}\n${dockviewCss}\n${overrides}`);
console.info("View built successfully");
