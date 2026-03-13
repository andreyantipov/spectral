import { type Container, type Directory, dag } from "@dagger.io/dagger";

export async function baseContainer(source: Directory): Promise<Container> {
	return dag
		.container()
		.from("oven/bun:latest")
		.withExec(["apt-get", "update"])
		.withExec(["apt-get", "install", "-y", "git", "ca-certificates"])
		.withDirectory("/app", source, {
			exclude: ["**/node_modules", "packages/infra/ci/sdk"],
		})
		.withWorkdir("/app")
		.withExec(["bun", "install", "--ignore-scripts"]);
}

export function run(container: Container, args: string[]): Container {
	return container.withExec(args);
}
