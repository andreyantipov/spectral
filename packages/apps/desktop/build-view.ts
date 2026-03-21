import { mkdirSync } from "node:fs";
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

import { readFileSync, writeFileSync } from "node:fs";

// Combine core.ui styles + dockview CSS into a single stylesheet
const coreStyles = readFileSync("../../libs/core.ui/build/styles.css", "utf8");
const dockviewCss = readFileSync(
	"../../../node_modules/dockview-core/dist/styles/dockview.css",
	"utf8",
);
// Override dockview defaults for dark theme integration
const dockviewOverrides = `
.dv-workspace .dv-default-tab { display: none !important; }
.dv-workspace .tabs-and-actions-container { display: none !important; }
.dv-workspace .groupview > .content-container { border-radius: 10px; overflow: hidden; }
.dv-workspace .split-view-container > .sash-container > .sash { background: transparent; transition: background 0.15s ease; }
.dv-workspace .split-view-container > .sash-container > .sash:hover { background: rgba(255,255,255,0.08); }
`;
writeFileSync("build/main-ui/styles.css", `${coreStyles}\n${dockviewCss}\n${dockviewOverrides}`);
console.info("View built successfully");
