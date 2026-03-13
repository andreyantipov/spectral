import type { Directory, Secret } from "@dagger.io/dagger";
import { baseContainer, run } from "../lib/base";

/**
 * Run semantic-release to create a version bump, changelog, and GitHub release.
 * Requires GITHUB_TOKEN for pushing tags and creating releases.
 */
export async function release(source: Directory, githubToken: Secret): Promise<string> {
	const container = await baseContainer(source);

	await run(
		container
			.withEnvVariable("CI", "true")
			.withEnvVariable("GITHUB_ACTIONS", "true")
			.withSecretVariable("GITHUB_TOKEN", githubToken)
			.withSecretVariable("GH_TOKEN", githubToken)
			.withExec(["git", "config", "--global", "user.name", "github-actions[bot]"])
			.withExec([
				"git",
				"config",
				"--global",
				"user.email",
				"github-actions[bot]@users.noreply.github.com",
			])
			.withExec([
				"git",
				"remote",
				"set-url",
				"origin",
				"https://github.com/andreyantipov/ctrl.page.git",
			]),
		["bunx", "semantic-release"],
	).sync();

	return "Release complete";
}
