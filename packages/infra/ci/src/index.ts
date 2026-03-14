import { type Directory, func, object, type Secret } from "@dagger.io/dagger";
import { build } from "./workflows/build";
import { lint, typecheck } from "./workflows/lint";
import { release } from "./workflows/release";

@object()
export class Ci {
	@func()
	async lint(source: Directory): Promise<string> {
		return lint(source);
	}

	@func()
	async typecheck(source: Directory): Promise<string> {
		return typecheck(source);
	}

	@func()
	async build(source: Directory): Promise<string> {
		return build(source);
	}

	@func()
	async release(source: Directory, githubToken: Secret): Promise<string> {
		return release(source, githubToken);
	}
}
