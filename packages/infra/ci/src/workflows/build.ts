import type { Directory } from "@dagger.io/dagger";
import { baseContainer, run } from "../lib/base";

export async function build(source: Directory): Promise<string> {
	const container = await baseContainer(source);
	await run(container, ["bunx", "turbo", "build", "--filter=!@ctrl/desktop"]).sync();
	return "Build passed";
}
