/**
 * Generates Obsidian wiki pages from metadata.json + dependency-cruiser Mermaid.
 *
 * Usage: bun run packages/tools/generate-wiki.ts
 *
 * Respects `manual: true` in frontmatter — won't overwrite manually edited pages.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "../..");
const METADATA_PATH = resolve(ROOT, "metadata.json");
const WIKI_DIR = resolve(ROOT, "docs/wiki");

type ServiceMeta = {
	name: string;
	tagId: string;
	package: string;
	packagePath: string;
	tier: string;
	methods: string[];
	requires: string[];
	providedBy: string;
};

type EventMeta = {
	tag: string;
	group: string;
	primaryKey: string;
	payloadFields: Array<{ name: string; type: string }>;
	successType: string;
};

type LayerEdge = {
	provider: string;
	provides: string;
	requires: string[];
};

type PackageMeta = {
	name: string;
	path: string;
	exports: string[];
	dependencies: string[];
	tier: string;
};

type AppMetadata = {
	generatedAt: string;
	packages: PackageMeta[];
	services: ServiceMeta[];
	events: EventMeta[];
	layers: LayerEdge[];
};

function isManual(filePath: string): boolean {
	if (!existsSync(filePath)) return false;
	const content = readFileSync(filePath, "utf-8");
	return content.includes("manual: true");
}

function writeIfNotManual(filePath: string, content: string) {
	if (isManual(filePath)) return;
	const dir = resolve(filePath, "..");
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	writeFileSync(filePath, content);
}

function generatePackageGraph(meta: AppMetadata): string {
	const lines = ["```mermaid", "graph TD"];

	const _tiers: Record<string, string> = {
		"core.port": "style-port",
		"core.base": "style-base",
		"core.ui": "style-ui",
		"domain.adapter": "style-adapter",
		"domain.feature": "style-feature",
		"domain.service": "style-service",
		"domain.runtime": "style-runtime",
		"ui.feature": "style-uifeat",
		"ui.scene": "style-scene",
	};

	for (const pkg of meta.packages) {
		const id = pkg.name.replace("@ctrl/", "").replace(/\./g, "_");
		const label = pkg.name.replace("@ctrl/", "");
		lines.push(`    ${id}["${label}"]`);
	}

	lines.push("");

	for (const pkg of meta.packages) {
		const fromId = pkg.name.replace("@ctrl/", "").replace(/\./g, "_");
		for (const dep of pkg.dependencies) {
			const toId = dep.replace("@ctrl/", "").replace(/\./g, "_");
			lines.push(`    ${fromId} --> ${toId}`);
		}
	}

	lines.push("```");
	return lines.join("\n");
}

function generateEventFlow(meta: AppMetadata): string {
	const lines = ["```mermaid", "graph LR"];

	lines.push('    UI["UI Layer"]');
	lines.push('    EB["EventBus"]');
	lines.push('    BS["BrowsingService"]');

	for (const svc of meta.services.filter((s) => s.tier === "domain.feature")) {
		const id = svc.name.replace(/Feature$/, "");
		lines.push(`    ${id}["${svc.name}"]`);
	}

	lines.push("");
	lines.push("    UI -->|dispatch| EB");
	lines.push("    EB -->|commands| BS");

	for (const svc of meta.services.filter((s) => s.tier === "domain.feature")) {
		const id = svc.name.replace(/Feature$/, "");
		lines.push(`    BS --> ${id}`);
	}

	for (const layer of meta.layers.filter((l) => l.requires.length > 0)) {
		const fromId = layer.provides.replace(/Feature$/, "");
		for (const req of layer.requires) {
			const toId = req.replace(/Repository$/, "Repo");
			lines.push(`    ${fromId} -->|uses| ${toId}["${req}"]`);
		}
	}

	lines.push("```");
	return lines.join("\n");
}

function generateLayerDiagram(meta: AppMetadata): string {
	const lines = ["```mermaid", "graph TB"];

	lines.push("    subgraph Ports");
	for (const svc of meta.services.filter((s) => s.tier === "core.port")) {
		lines.push(`        ${svc.name}`);
	}
	lines.push("    end");

	lines.push("    subgraph Features");
	for (const svc of meta.services.filter((s) => s.tier === "domain.feature")) {
		lines.push(`        ${svc.name}`);
	}
	lines.push("    end");

	lines.push("    subgraph Services");
	for (const svc of meta.services.filter((s) => s.tier === "domain.service")) {
		lines.push(`        ${svc.name}`);
	}
	lines.push("    end");

	lines.push("");

	for (const layer of meta.layers) {
		for (const req of layer.requires) {
			lines.push(`    ${layer.provides} --> ${req}`);
		}
	}

	lines.push("```");
	return lines.join("\n");
}

function generateOverview(meta: AppMetadata): string {
	return `---
generated: true
---
# Architecture Overview

> Auto-generated from code. Run \`bun run docs:update\` to refresh.

## Package Graph

${generatePackageGraph(meta)}

## Event Flow

${generateEventFlow(meta)}

## Layer Diagram (Hexagonal)

${generateLayerDiagram(meta)}

## Stats

- **${meta.packages.length}** packages
- **${meta.services.length}** services
- **${meta.events.length}** events/commands
- **${meta.layers.length}** layer edges
`;
}

function generateServicePage(svc: ServiceMeta, meta: AppMetadata): string {
	const _events = meta.events.filter((e) =>
		e.group.includes(svc.name.toLowerCase().replace("feature", "")),
	);
	const _layer = meta.layers.find((l) => l.provides === svc.name);

	return `---
generated: true
---
# ${svc.name}

**Package:** \`${svc.package}\`
**Tier:** ${svc.tier}
**Tag ID:** ${svc.tagId}
**Provided by:** ${svc.providedBy || "—"}

## Methods

${svc.methods.map((m) => `- \`${m}\``).join("\n") || "—"}

## Dependencies

${svc.requires.length > 0 ? svc.requires.map((r) => `- [[${r}]]`).join("\n") : "None"}

## Layer Graph

\`\`\`mermaid
graph LR
    ${svc.providedBy || `${svc.name}Live`} -->|provides| ${svc.name}
${svc.requires.map((r) => `    ${svc.name} -->|requires| ${r}`).join("\n")}
\`\`\`
`;
}

function generateEventPage(event: EventMeta): string {
	const payload = event.payloadFields.map((f) => `| ${f.name} | ${f.type} |`).join("\n");

	return `---
generated: true
---
# ${event.tag}

**Group:** ${event.group}
**Primary Key:** \`${event.primaryKey}\`
**Response:** ${event.successType}

## Payload

| Field | Type |
|-------|------|
${payload || "| — | — |"}

## Flow

\`\`\`mermaid
sequenceDiagram
    UI->>EventBus: dispatch("${event.tag}")
    EventBus->>BrowsingService: command
    BrowsingService->>Feature: handle
    Feature-->>EventBus: state.snapshot
\`\`\`
`;
}

function main() {
	if (!existsSync(METADATA_PATH)) {
		process.stderr.write("metadata.json not found. Run: bun run docs:meta\n");
		process.exit(1);
	}

	const meta: AppMetadata = JSON.parse(readFileSync(METADATA_PATH, "utf-8"));

	writeIfNotManual(resolve(WIKI_DIR, "architecture/overview.md"), generateOverview(meta));

	for (const svc of meta.services) {
		writeIfNotManual(resolve(WIKI_DIR, `services/${svc.name}.md`), generateServicePage(svc, meta));
	}

	for (const event of meta.events) {
		writeIfNotManual(resolve(WIKI_DIR, `events/${event.tag}.md`), generateEventPage(event));
	}

	writeIfNotManual(
		resolve(WIKI_DIR, "README.md"),
		`---
generated: true
---
# ctrl.page Wiki

- [[architecture/overview|Architecture Overview]]
- Services: ${meta.services.map((s) => `[[services/${s.name}|${s.name}]]`).join(", ")}
- Events: ${meta.events.map((e) => `[[events/${e.tag}|${e.tag}]]`).join(", ")}
- [[decisions/|Architecture Decisions]]

> Generated: ${meta.generatedAt}
`,
	);

	const serviceCount = meta.services.length;
	const eventCount = meta.events.length;
	process.stdout.write(
		`Wiki generated: 1 overview + ${serviceCount} services + ${eventCount} events\n`,
	);
}

main();
