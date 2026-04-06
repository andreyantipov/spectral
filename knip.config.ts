import type { KnipConfig } from "knip";

const config: KnipConfig = {
	workspaces: {
		// Root
		".": {
			entry: ["packages/tools/*.ts", "!packages/tools/*.test.ts"],
			project: ["packages/tools/**/*.ts"],
			ignore: ["packages/tools/**/*.test.ts"],
		},

		// Library packages — all share the same structure
		"packages/libs/*": {
			entry: ["src/index.ts", "src/**/*.test-utils.ts"],
			project: ["src/**/*.{ts,tsx}"],
		},

		// UI components — has storybook stories + panda config
		"packages/libs/ui.base.components": {
			entry: ["src/index.ts", "src/**/*.stories.tsx", "panda.config.ts"],
			project: ["src/**/*.{ts,tsx}"],
		},

		// Desktop app — electrobun bundles bun + webview separately
		// main-ui is a separate webview entry built by build-view.ts
		"packages/apps/desktop": {
			entry: [
				"src/bun/index.ts",
				"src/main-ui/index.ts",
				"electrobun.config.ts",
			],
			project: ["src/**/*.{ts,tsx}", "*.ts"],
			ignoreDependencies: [
				// These are bundled into webview via build-view.ts, not direct imports
				"@ctrl/ui.base.components",
				"@ctrl/domain.feature.settings",
				"@ctrl/base.schema",
				"@ctrl/base.tracing",
				"@ctrl/core.contract.storage",
			],
		},

		// Dev docs (EventCatalog) — external build system
		"packages/apps/dev-docs": {
			entry: ["eventcatalog.config.js"],
			project: ["**/*.{ts,js}"],
			ignoreDependencies: ["@eventcatalog/linter", "astro"],
		},

		// Infra CI — Dagger SDK
		"packages/infra/ci": {
			entry: ["src/index.ts"],
			project: ["src/**/*.ts"],
			ignoreDependencies: ["@dagger.io/dagger"],
		},
	},

	ignore: [
		// Vendor code is not managed by us
		"packages/vendor/**",
	],

	// Knip plugins
	vitest: true,
	storybook: true,

	// Don't report enum members or unused exports (monorepo packages export public APIs
	// that may not have external consumers yet — false positive noise)
	exclude: ["enumMembers", "nsExports", "nsTypes", "exports", "types"],

	// Binaries provided by nix develop, not npm
	ignoreBinaries: [
		"ast-grep",
		"dot",
		"dagger",
		"pkill",
		"otelcol-contrib",
		"otel-tui",
	],
};

export default config;
