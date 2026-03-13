import type { Directory } from "@dagger.io/dagger";
import { baseContainer, run } from "../lib/base";

export async function lint(source: Directory): Promise<string> {
	const container = await baseContainer(source);

	// Run biome and grit separately — grit needs network access at startup
	await run(container, ["bunx", "biome", "check", "."]).sync();
	await run(container, ["bunx", "@getgrit/cli", "check", "."]).sync();

	return "Lint passed";
}

export async function typecheck(source: Directory): Promise<string> {
	const container = await baseContainer(source);
	await run(container, ["bun", "run", "check"]).sync();
	return "Typecheck passed";
}
