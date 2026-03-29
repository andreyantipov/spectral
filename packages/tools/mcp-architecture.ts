/**
 * Architecture MCP server — reads metadata.json and exposes tools for querying
 * Effect services, EventBus events, Layer graphs, and package dependencies.
 *
 * Usage: bun run packages/tools/mcp-architecture.ts
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ── Metadata types ───────────────────────────────────────────────────────────

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

// ── Metadata loader ──────────────────────────────────────────────────────────

const METADATA_PATH = resolve(import.meta.dir, "../metadata.json");

function loadMetadata(): AppMetadata {
	const raw = readFileSync(METADATA_PATH, "utf-8");
	return JSON.parse(raw) as AppMetadata;
}

// ── Tool handlers ────────────────────────────────────────────────────────────

function handleListServices(): string {
	const meta = loadMetadata();
	const lines = meta.services.map((s) => {
		const deps = s.requires.length > 0 ? s.requires.join(", ") : "none";
		return `- ${s.name} (${s.package}) [tier: ${s.tier}] requires: ${deps}`;
	});
	return `## Services (${meta.services.length})\n\n${lines.join("\n")}`;
}

function handleListEvents(): string {
	const meta = loadMetadata();
	const grouped = new Map<string, EventMeta[]>();

	for (const event of meta.events) {
		const existing = grouped.get(event.group) ?? [];
		existing.push(event);
		grouped.set(event.group, existing);
	}

	const sections: string[] = [];
	for (const [group, events] of grouped) {
		const eventLines = events.map((e) => {
			const payload =
				e.payloadFields.length > 0
					? e.payloadFields.map((f) => `${f.name}: ${f.type}`).join(", ")
					: "none";
			return `  - ${e.tag} → ${e.successType} (payload: ${payload})`;
		});
		sections.push(`### ${group}\n${eventLines.join("\n")}`);
	}

	return `## Events (${meta.events.length})\n\n${sections.join("\n\n")}`;
}

function handleGetService(name: string): string {
	const meta = loadMetadata();
	const svc = meta.services.find(
		(s) =>
			s.name.toLowerCase() === name.toLowerCase() || s.tagId.toLowerCase() === name.toLowerCase(),
	);

	if (!svc) {
		const available = meta.services.map((s) => s.name).join(", ");
		return `Service "${name}" not found. Available: ${available}`;
	}

	const layer = meta.layers.find((l) => l.provides === svc.name);
	const methods = svc.methods.length > 0 ? svc.methods.join(", ") : "none";
	const requires = svc.requires.length > 0 ? svc.requires.join(", ") : "none";
	const layerInfo = layer
		? `${layer.provider} (requires: ${layer.requires.join(", ") || "none"})`
		: "unknown";

	return [
		`## ${svc.name}`,
		"",
		`- **Tag ID:** ${svc.tagId}`,
		`- **Package:** ${svc.package}`,
		`- **Path:** ${svc.packagePath}`,
		`- **Tier:** ${svc.tier}`,
		`- **Methods:** ${methods}`,
		`- **Requires:** ${requires}`,
		`- **Provided by:** ${layerInfo}`,
	].join("\n");
}

function handleGetLayerGraph(): string {
	const meta = loadMetadata();

	if (meta.layers.length === 0) return "No layers found in metadata.";

	const lines = meta.layers.map((l) => {
		const deps = l.requires.length > 0 ? l.requires.join(", ") : "none";
		return `- ${l.provider} → provides ${l.provides}, requires [${deps}]`;
	});

	return `## Layer Graph (${meta.layers.length})\n\n${lines.join("\n")}`;
}

function handleGetPackageDeps(name: string): string {
	const meta = loadMetadata();
	const pkg = meta.packages.find(
		(p) => p.name === name || p.name === `@ctrl/${name}` || p.path.endsWith(name),
	);

	if (!pkg) {
		const available = meta.packages.map((p) => p.name).join(", ");
		return `Package "${name}" not found. Available: ${available}`;
	}

	const dependents = meta.packages.filter((p) => p.dependencies.includes(pkg.name));
	const deps = pkg.dependencies.length > 0 ? pkg.dependencies.join("\n  - ") : "none";
	const depNames = dependents.length > 0 ? dependents.map((d) => d.name).join("\n  - ") : "none";
	const exports = pkg.exports.length > 0 ? pkg.exports.join(", ") : "none";

	return [
		`## ${pkg.name}`,
		"",
		`- **Path:** ${pkg.path}`,
		`- **Tier:** ${pkg.tier}`,
		`- **Exports:** ${exports}`,
		`- **Dependencies:**`,
		`  - ${deps}`,
		`- **Dependents (used by):**`,
		`  - ${depNames}`,
	].join("\n");
}

function handleFindEventFlow(eventTag: string): string {
	const meta = loadMetadata();
	const event = meta.events.find((e) => e.tag === eventTag || e.tag.includes(eventTag));

	if (!event) {
		const available = meta.events.map((e) => e.tag).join(", ");
		return `Event "${eventTag}" not found. Available: ${available}`;
	}

	const relatedEvents = meta.events.filter((e) => e.tag !== event.tag && e.group === event.group);
	const handlerServices = meta.services.filter((s) => s.methods.some((m) => event.tag.includes(m)));

	const payload =
		event.payloadFields.length > 0
			? event.payloadFields.map((f) => `  - ${f.name}: ${f.type}`).join("\n")
			: "  none";

	const related =
		relatedEvents.length > 0 ? relatedEvents.map((e) => `  - ${e.tag}`).join("\n") : "  none";

	const handlers =
		handlerServices.length > 0
			? handlerServices.map((s) => `  - ${s.name} (${s.package})`).join("\n")
			: "  (no direct match found — check handlers manually)";

	return [
		`## Event Flow: ${event.tag}`,
		"",
		`- **Group:** ${event.group}`,
		`- **Primary Key:** ${event.primaryKey}`,
		`- **Response:** ${event.successType}`,
		"- **Payload:**",
		payload,
		"- **Potential handlers:**",
		handlers,
		"- **Related events in group:**",
		related,
	].join("\n");
}

// ── Server setup ─────────────────────────────────────────────────────────────

const server = new McpServer({
	name: "ctrl-page-architecture",
	version: "1.0.0",
});

server.tool("list_services", "List all Effect services with their dependencies", {}, () => {
	return { content: [{ type: "text", text: handleListServices() }] };
});

server.tool("list_events", "List all EventBus commands and events", {}, () => {
	return { content: [{ type: "text", text: handleListEvents() }] };
});

server.tool(
	"get_service",
	"Get details of a specific Effect service by name",
	{ name: z.string().describe("Service name or tag ID") },
	({ name }) => {
		return { content: [{ type: "text", text: handleGetService(name) }] };
	},
);

server.tool("get_layer_graph", "Show the Layer dependency graph", {}, () => {
	return { content: [{ type: "text", text: handleGetLayerGraph() }] };
});

server.tool(
	"get_package_deps",
	"Show workspace dependencies for a package",
	{
		name: z
			.string()
			.describe("Package name (e.g. core.contract.storage or @ctrl/core.contract.storage)"),
	},
	({ name }) => {
		return { content: [{ type: "text", text: handleGetPackageDeps(name) }] };
	},
);

server.tool(
	"find_event_flow",
	"Trace an event through the system — shows payload, handlers, and related events",
	{ tag: z.string().describe("Event tag or partial match (e.g. session.create)") },
	({ tag }) => {
		return { content: [{ type: "text", text: handleFindEventFlow(tag) }] };
	},
);

// ── Start ────────────────────────────────────────────────────────────────────

async function start() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	process.stderr.write("Architecture MCP server running on stdio\n");
}

start();
