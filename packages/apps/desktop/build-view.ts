import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { SolidPlugin } from "@dschz/bun-plugin-solid";

mkdirSync("build/main-ui", { recursive: true });

const result = await Bun.build({
	entrypoints: ["src/main-ui/index.ts"],
	outdir: "build/main-ui",
	target: "browser",
	// Externalize Node.js-only OTEL packages — they are never loaded in the
	// browser bundle; OtelLive("web") uses WebSdk (dynamic import) at runtime.
	external: ["@opentelemetry/sdk-trace-node", "@opentelemetry/context-async-hooks"],
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

// Combine ui.base.components styles (dockview removed — CSS Grid tiling now)
const coreStyles = readFileSync("../../libs/ui.base.components/build/styles.css", "utf8");
writeFileSync("build/main-ui/styles.css", coreStyles);
console.info("View built successfully");
