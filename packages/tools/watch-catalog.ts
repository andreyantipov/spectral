/**
 * File watcher: re-generates EventCatalog on source code changes.
 * Starts EventCatalog dev server in background and watches for .ts changes
 * in relevant source directories.
 *
 * Usage: bun run packages/tools/watch-catalog.ts
 */

import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "../..");

const WATCH_DIRS = [
	"packages/libs/core.contract.event-bus/src",
	"packages/libs/domain.feature.session/src",
	"packages/libs/domain.feature.bookmark/src",
	"packages/libs/domain.feature.history/src",
	"packages/libs/domain.feature.layout/src",
	"packages/libs/domain.feature.omnibox/src",
	"packages/libs/domain.service.workspace/src",
	"packages/libs/ui.base.api/src",
];

function regenerate() {
	process.stderr.write("[watch-catalog] Change detected, regenerating...\n");
	const child = spawn("bun", ["run", "docs:meta"], { cwd: ROOT, stdio: "inherit" });
	child.on("close", (code) => {
		if (code !== 0) {
			process.stderr.write("[watch-catalog] docs:meta failed\n");
			return;
		}
		const catalog = spawn("bun", ["run", "docs:catalog"], { cwd: ROOT, stdio: "inherit" });
		catalog.on("close", (c) => {
			if (c === 0) {
				process.stderr.write("[watch-catalog] Catalog updated.\n");
			} else {
				process.stderr.write("[watch-catalog] docs:catalog failed\n");
			}
		});
	});
}

// Start EventCatalog dev server in background
const catalogDev = spawn("bun", ["run", "dev"], {
	cwd: resolve(ROOT, "packages/apps/dev-docs"),
	stdio: "inherit",
});

// Watch source directories for .ts changes (debounced)
let timeout: ReturnType<typeof setTimeout> | null = null;
for (const dir of WATCH_DIRS) {
	const fullPath = resolve(ROOT, dir);
	try {
		watch(fullPath, { recursive: true }, (_event, filename) => {
			if (!filename?.endsWith(".ts")) return;
			if (timeout) clearTimeout(timeout);
			timeout = setTimeout(regenerate, 500);
		});
	} catch {
		process.stderr.write(`[watch-catalog] Warning: cannot watch ${dir}\n`);
	}
}

process.on("SIGINT", () => {
	catalogDev.kill();
	process.exit();
});

process.stderr.write("[watch-catalog] Watching for changes. EventCatalog dev server starting...\n");
