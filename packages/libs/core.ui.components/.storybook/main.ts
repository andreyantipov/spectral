import type { StorybookConfig } from "storybook-solidjs-vite";

const config: StorybookConfig = {
	stories: ["../src/**/*.stories.tsx"],
	framework: "storybook-solidjs-vite",
	viteFinal(config) {
		config.server ??= {};
		config.server.watch ??= {};
		config.server.watch.ignored = [
			...(Array.isArray(config.server.watch.ignored)
				? config.server.watch.ignored
				: config.server.watch.ignored
					? [config.server.watch.ignored]
					: []),
			"**/styled-system/**",
			"**/build/**",
		];
		return config;
	},
};

export default config;
