import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

const outDir = "build/bun-deps";

// Clean and recreate
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// Create a minimal package.json and install @libsql/client with all its deps
writeFileSync(
	`${outDir}/package.json`,
	JSON.stringify({
		private: true,
		dependencies: { "@libsql/client": "latest" },
	}),
);

execSync("bun install --production", { cwd: outDir, stdio: "inherit" });
console.log("Native deps prepared");
