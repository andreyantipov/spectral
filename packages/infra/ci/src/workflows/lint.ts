import type { Directory } from "@dagger.io/dagger";
import { baseContainer, run } from "../lib/base";

export async function lint(source: Directory): Promise<string> {
	const container = await baseContainer(source);

	await run(container, ["bunx", "biome", "check", "."]).sync();
	// grit CLI panics in containers due to TLS/networking issues at startup
	// TODO: re-enable when grit fixes container support
	// await run(container, ["bunx", "@getgrit/cli", "check", "."]).sync();

	return "Lint passed";
}

export async function typecheck(source: Directory): Promise<string> {
	const container = await baseContainer(source);
	// Build first to generate styled-system/ and dist/ outputs,
	// then check in the same container layer so outputs are available
	const built = run(container, ["bunx", "turbo", "build", "--filter=!@ctrl/desktop"]);
	await run(built, ["bun", "run", "check"]).sync();
	return "Typecheck passed";
}
