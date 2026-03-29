/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
	forbidden: [
		{
			name: "feature-no-peer-import",
			comment: "domain.feature.* must not import other domain.feature.*",
			severity: "error",
			from: { path: "^packages/libs/domain\\.feature\\.([^/]+)" },
			to: {
				path: "^packages/libs/domain\\.feature\\.",
				pathNot: "^packages/libs/domain\\.feature\\.$1",
			},
		},
		{
			name: "adapter-no-feature",
			comment: "domain.adapter.* must not import domain.feature.*",
			severity: "error",
			from: { path: "^packages/libs/domain\\.adapter" },
			to: { path: "^packages/libs/domain\\.feature" },
		},
		{
			name: "core-no-domain",
			comment: "core.* must not import domain.* or ui.*",
			severity: "error",
			from: { path: "^packages/libs/core\\." },
			to: { path: "^packages/libs/(domain|ui)\\." },
		},
		{
			name: "ui-no-adapter",
			comment: "ui.* must not import domain.adapter.*",
			severity: "error",
			from: { path: "^packages/libs/ui\\." },
			to: { path: "^packages/libs/domain\\.adapter" },
		},
		{
			name: "ui-no-feature-direct",
			comment: "ui.feature.* must not import domain.feature.* (only domain.service.*)",
			severity: "error",
			from: { path: "^packages/libs/ui\\.feature" },
			to: { path: "^packages/libs/domain\\.feature" },
		},
		{
			name: "no-barrel-reexports",
			comment:
				"Barrel files must not import/re-export from other @ctrl/* packages directly. Runtime packages are exempt (they compose layers).",
			severity: "error",
			from: {
				path: "^packages/libs/([^/]+)/src/index\\.ts$",
				pathNot: "^packages/libs/domain\\.runtime",
			},
			to: {
				path: "^packages/libs/(?!$1/)",
			},
		},
	],
	options: {
		doNotFollow: { path: "node_modules" },
		exclude: { path: "node_modules" },
		tsPreCompilationDeps: true,
		tsConfig: { fileName: "tsconfig.json" },
		enhancedResolveOptions: {
			exportsFields: ["exports"],
			conditionNames: ["import", "require", "node", "default"],
		},
		reporterOptions: {
			archi: {
				collapsePattern: "^packages/libs/([^/]+)",
				theme: {
					graph: { rankdir: "TB" },
					modules: [
						{
							criteria: { source: "core\\.base" },
							attributes: { fillcolor: "#e8f5e9" },
						},
						{
							criteria: { source: "core\\.port" },
							attributes: { fillcolor: "#e3f2fd" },
						},
						{
							criteria: { source: "core\\.ui" },
							attributes: { fillcolor: "#f3e5f5" },
						},
						{
							criteria: { source: "domain\\.adapter" },
							attributes: { fillcolor: "#fff3e0" },
						},
						{
							criteria: { source: "domain\\.feature" },
							attributes: { fillcolor: "#fce4ec" },
						},
						{
							criteria: { source: "domain\\.service" },
							attributes: { fillcolor: "#fff9c4" },
						},
						{
							criteria: { source: "ui\\." },
							attributes: { fillcolor: "#e0f7fa" },
						},
					],
				},
			},
		},
	},
};
