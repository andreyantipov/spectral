import type { Container, Directory } from "@dagger.io/dagger";
import { type CiConfig, defaultConfig } from "./config";
import { createBase, withNodeJs, withSource } from "./containers";

export function baseContainer(source: Directory, config: CiConfig = defaultConfig): Container {
	return withSource(withNodeJs(createBase(config), config.nodeMajorVersion), source, config);
}

export function run(container: Container, args: string[]): Container {
	return container.withExec(args);
}
