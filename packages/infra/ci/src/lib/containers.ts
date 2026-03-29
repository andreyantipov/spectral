import { type Container, type Directory, dag, type Secret } from "@dagger.io/dagger";
import type { CiConfig } from "./config";

export function createBase(config: CiConfig): Container {
	return dag
		.container()
		.from(config.image)
		.withExec(["apt-get", "update"])
		.withExec(["apt-get", "install", "-y", "git", "ca-certificates", "curl"]);
}

export function withNodeJs(container: Container, majorVersion: number): Container {
	return container.withExec([
		"sh",
		"-c",
		`curl -fsSL https://deb.nodesource.com/setup_${majorVersion}.x | bash - && apt-get install -y nodejs`,
	]);
}

export function withSource(container: Container, source: Directory, config: CiConfig): Container {
	return container
		.withDirectory(config.workdir, source, { exclude: config.mountExcludes })
		.withWorkdir(config.workdir)
		.withExec(["bun", "install", "--ignore-scripts"])
		.withExec(["npm", "install", "-g", "--force", "@ast-grep/cli@0.33.1"]);
}

export function withGitIdentity(container: Container, config: CiConfig): Container {
	return container
		.withExec(["git", "config", "--global", "user.name", config.gitBotName])
		.withExec(["git", "config", "--global", "user.email", config.gitBotEmail]);
}

export function withGitHubAuth(container: Container, token: Secret): Container {
	return container.withSecretVariable("GITHUB_TOKEN", token).withSecretVariable("GH_TOKEN", token);
}
