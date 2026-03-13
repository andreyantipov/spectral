import { type Container, type Directory, dag } from "@dagger.io/dagger";

export async function baseContainer(source: Directory): Promise<Container> {
	return dag
		.container()
		.from("oven/bun:latest")
		.withDirectory("/app", source, {
			exclude: ["**/node_modules", "packages/infra/ci/sdk"],
		})
		.withWorkdir("/app")
		.withExec(["bun", "install"]);
}

export function run(container: Container, args: string[]): Container {
	return container.withExec(args);
}
