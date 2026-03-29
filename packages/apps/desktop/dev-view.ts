import { watch } from "node:fs";
import { resolve } from "node:path";

const DEBOUNCE_MS = 200;

const watchDirs = [
	resolve("src/main-ui"),
	resolve("../../libs/ui.base.components/src"),
	resolve("../../libs/core.contract.storage/src"),
];

async function buildView() {
	const start = Date.now();
	const proc = Bun.spawn(["bun", "run", "build-view.ts"], {
		cwd: import.meta.dir,
		stdout: "inherit",
		stderr: "inherit",
	});
	const code = await proc.exited;
	if (code === 0) {
		console.info(`[dev-view] Rebuilt in ${Date.now() - start}ms`);
	} else {
	}
}

// Initial build
await buildView();

// Watch for changes
let timeout: ReturnType<typeof setTimeout> | null = null;

for (const dir of watchDirs) {
	try {
		watch(dir, { recursive: true }, (_event, filename) => {
			if (!filename || filename.includes("node_modules")) return;
			if (timeout) clearTimeout(timeout);
			timeout = setTimeout(async () => {
				console.info(`[dev-view] Change detected: ${filename}`);
				await buildView();
			}, DEBOUNCE_MS);
		});
		console.info(`[dev-view] Watching ${dir}`);
	} catch {}
}

console.info("[dev-view] Watching for UI changes...");

// Keep process alive
process.on("SIGINT", () => process.exit(0));
setInterval(() => {}, 60_000);
