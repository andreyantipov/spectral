/**
 * Metadata extractor — parses Effect patterns from the monorepo using ts-morph.
 *
 * Extracts: Context.Tag declarations, EventGroup.add chains, Layer composition,
 * and package metadata. Outputs AppMetadata JSON to stdout.
 *
 * Usage: bun run packages/tools/extract-metadata.ts [--format=markdown]
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import {
	type CallExpression,
	type ClassDeclaration,
	Node,
	Project,
	type SourceFile,
} from "ts-morph";

// ── Output types ──────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROOT = resolve(import.meta.dir, "../..");
const LIBS_DIR = resolve(ROOT, "packages/libs");
const TEST_SERVICES = new Set(["TestSpanExporter"]);

function deriveTier(pkgName: string): string {
	const tiers: [string, string][] = [
		["core.port", "core.port"],
		["core.base", "core.base"],
		["core.ui", "core.ui"],
		["domain.adapter", "domain.adapter"],
		["domain.feature", "domain.feature"],
		["domain.service", "domain.service"],
		["ui.feature", "ui.feature"],
		["ui.scenes", "ui.scenes"],
	];
	return tiers.find(([prefix]) => pkgName.startsWith(prefix))?.[1] ?? "unknown";
}

function isSourceFile(filePath: string): boolean {
	return !filePath.includes("node_modules") && !filePath.includes(".test.");
}

function packageFromPath(filePath: string): { dir: string; name: string } {
	const match = filePath.match(/packages\/libs\/([^/]+)/);
	const dir = match ? match[1] : "unknown";
	return { dir, name: `@ctrl/${dir}` };
}

// ── Package scanner ───────────────────────────────────────────────────────────

function parseBarrelExports(indexPath: string): string[] {
	if (!existsSync(indexPath)) return [];

	const content = readFileSync(indexPath, "utf-8");
	const exports: string[] = [];

	for (const match of content.matchAll(/export\s+\{([^}]+)\}/g)) {
		const names = match[1]
			.split(",")
			.map((n) =>
				n
					.trim()
					.split(/\s+as\s+/)
					.pop()
					?.trim(),
			)
			.filter(Boolean);
		exports.push(...names);
	}

	for (const match of content.matchAll(/export\s+(?:class|const|function)\s+(\w+)/g)) {
		if (!exports.includes(match[1])) exports.push(match[1]);
	}

	return exports;
}

function scanPackages(): PackageMeta[] {
	const dirs = readdirSync(LIBS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());

	return dirs
		.filter((dir) => existsSync(resolve(LIBS_DIR, dir.name, "package.json")))
		.map((dir) => {
			const pkgJson = JSON.parse(
				readFileSync(resolve(LIBS_DIR, dir.name, "package.json"), "utf-8"),
			);
			return {
				name: pkgJson.name ?? `@ctrl/${dir.name}`,
				path: `packages/libs/${dir.name}`,
				exports: parseBarrelExports(resolve(LIBS_DIR, dir.name, "src/index.ts")),
				dependencies: Object.keys(pkgJson.dependencies ?? {}).filter((d: string) =>
					d.startsWith("@ctrl/"),
				),
				tier: deriveTier(dir.name),
			};
		});
}

// ── Context.Tag parser ────────────────────────────────────────────────────────

function extractTagId(extendsText: string, fallback: string): string {
	const tagMatch = extendsText.match(/Context\.Tag\(([^)]+)\)/);
	if (!tagMatch) return fallback;
	const raw = tagMatch[1].trim();
	return raw.startsWith('"') || raw.startsWith("'") ? raw.replace(/['"]/g, "") : raw;
}

function extractMethods(cls: ClassDeclaration): string[] {
	const methods: string[] = [];
	for (const m of cls.getText().matchAll(/readonly\s+(\w+)\s*:/g)) {
		methods.push(m[1]);
	}
	return methods;
}

function parseServiceFromClass(cls: ClassDeclaration, filePath: string): ServiceMeta | null {
	const extendsExpr = cls.getExtends();
	if (!extendsExpr) return null;

	const text = extendsExpr.getText();
	if (!text.includes("Context.Tag")) return null;

	const className = cls.getName() ?? "Unknown";
	const pkg = packageFromPath(filePath);

	return {
		name: className,
		tagId: extractTagId(text, className),
		package: pkg.name,
		packagePath: `packages/libs/${pkg.dir}`,
		tier: deriveTier(pkg.dir),
		methods: extractMethods(cls),
		requires: [],
		providedBy: "",
	};
}

function parseContextTags(project: Project): ServiceMeta[] {
	const services: ServiceMeta[] = [];

	for (const sourceFile of project.getSourceFiles()) {
		if (!isSourceFile(sourceFile.getFilePath())) continue;
		for (const cls of sourceFile.getClasses()) {
			const svc = parseServiceFromClass(cls, sourceFile.getFilePath());
			if (svc) services.push(svc);
		}
	}

	// Deduplicate by name, preferring the one with more methods. Filter test-only services.
	const seen = new Map<string, ServiceMeta>();
	for (const svc of services) {
		if (TEST_SERVICES.has(svc.name)) continue;
		const existing = seen.get(svc.name);
		if (!existing || svc.methods.length > existing.methods.length) {
			seen.set(svc.name, svc);
		}
	}
	return Array.from(seen.values());
}

// ── EventGroup.add parser ─────────────────────────────────────────────────────

function collectAddCalls(node: Node): CallExpression[] {
	const calls: CallExpression[] = [];
	const check = (n: Node) => {
		if (Node.isCallExpression(n)) {
			const expr = n.getExpression();
			if (Node.isPropertyAccessExpression(expr) && expr.getName() === "add") {
				calls.push(n);
			}
		}
	};
	check(node);
	node.forEachDescendant(check);
	return calls;
}

function extractPayloadFields(objText: string): Array<{ name: string; type: string }> {
	const structMatch = objText.match(/Schema\.Struct\(\{([^}]+)\}\)/);
	if (!structMatch) return [];

	const fields: Array<{ name: string; type: string }> = [];
	for (const m of structMatch[1].matchAll(/(\w+):\s*(Schema\.\w+(?:\([^)]*\))?|\w+)/g)) {
		fields.push({ name: m[1], type: m[2].replace(/^Schema\./, "").replace(/\(.*\)$/, "") });
	}
	return fields;
}

function parseEventFromAddCall(call: CallExpression, groupName: string): EventMeta | null {
	const args = call.getArguments();
	if (args.length === 0) return null;

	const objText = args[0].getText();
	const tagMatch = objText.match(/tag:\s*"([^"]+)"/);
	if (!tagMatch) return null;

	const pkMatch = objText.match(/primaryKey:\s*((?:\([^)]*\)\s*=>|[^,]+=>)\s*[^,}]+)/);
	const successMatch = objText.match(/success:\s*(\S+)/);
	let successType = successMatch ? successMatch[1].replace(/,?\s*$/, "") : "void";
	if (successType === "Schema.Void") successType = "void";

	return {
		tag: tagMatch[1],
		group: groupName,
		primaryKey: pkMatch ? pkMatch[1].trim() : "unknown",
		payloadFields: extractPayloadFields(objText),
		successType,
	};
}

function parseEventsFromFile(sourceFile: SourceFile): EventMeta[] {
	const filePath = sourceFile.getFilePath();
	const groupName = basename(filePath, ".ts");
	const events: EventMeta[] = [];

	for (const varDecl of sourceFile.getVariableDeclarations()) {
		const init = varDecl.getInitializer();
		if (!init?.getText().includes("EventGroup.empty")) continue;

		for (const call of collectAddCalls(init)) {
			const event = parseEventFromAddCall(call, groupName);
			if (event) events.push(event);
		}
	}

	return events;
}

function parseEventGroups(project: Project): EventMeta[] {
	const groupsDir = resolve(LIBS_DIR, "core.port.event-bus/src/groups");

	return project
		.getSourceFiles()
		.filter((sf) => sf.getFilePath().startsWith(groupsDir) && !sf.getFilePath().includes(".test."))
		.flatMap(parseEventsFromFile);
}

// ── Layer parser ──────────────────────────────────────────────────────────────

function extractLayerRequires(
	initText: string,
	serviceByTag: Map<string, ServiceMeta>,
	provides: string,
): string[] {
	const requires: string[] = [];

	for (const m of initText.matchAll(/yield\*\s+(\w+)/g)) {
		if (serviceByTag.has(m[1]) && m[1] !== provides) requires.push(m[1]);
	}

	if (initText.includes("makeFeatureService")) {
		const repoMatch = initText.match(/repoTag:\s*(\w+)/);
		if (repoMatch && serviceByTag.has(repoMatch[1])) requires.push(repoMatch[1]);
	}

	return requires;
}

function isLayerInit(text: string): boolean {
	return (
		text.includes("Layer.effect") ||
		text.includes("Layer.scopedDiscard") ||
		text.includes("makeFeatureService")
	);
}

function parseLayersFromFile(
	sourceFile: SourceFile,
	serviceByTag: Map<string, ServiceMeta>,
): LayerEdge[] {
	const edges: LayerEdge[] = [];

	for (const varDecl of sourceFile.getVariableDeclarations()) {
		const name = varDecl.getName();
		if (!name.endsWith("Live")) continue;

		const initText = varDecl.getInitializer()?.getText();
		if (!initText || !isLayerInit(initText)) continue;

		const provides = name.replace(/Live$/, "");
		const requires = extractLayerRequires(initText, serviceByTag, provides);
		edges.push({ provider: name, provides, requires });

		const svc = serviceByTag.get(provides);
		if (svc) {
			svc.providedBy = name;
			svc.requires = requires;
		}
	}

	return edges;
}

function deduplicateByKey<T>(items: T[], key: (item: T) => string, prefer: (a: T, b: T) => T): T[] {
	const seen = new Map<string, T>();
	for (const item of items) {
		const k = key(item);
		const existing = seen.get(k);
		seen.set(k, existing ? prefer(existing, item) : item);
	}
	return Array.from(seen.values());
}

function parseLayers(project: Project, services: ServiceMeta[]): LayerEdge[] {
	const serviceByTag = new Map(services.map((s) => [s.name, s]));

	const layers = project
		.getSourceFiles()
		.filter((sf) => isSourceFile(sf.getFilePath()))
		.flatMap((sf) => parseLayersFromFile(sf, serviceByTag));

	return deduplicateByKey(
		layers,
		(l) => l.provider,
		(a, b) => (b.requires.length > a.requires.length ? b : a),
	);
}

// ── Markdown generator ────────────────────────────────────────────────────────

function generateMarkdown(meta: AppMetadata): string {
	const lines: string[] = [
		"<!-- AUTO-GENERATED — do not edit manually. Run: bun run docs:meta -->",
		"",
		"# Architecture Snapshot",
		"",
		`Generated: ${meta.generatedAt}`,
		"",
		`## Packages (${meta.packages.length})`,
		"",
		"| Package | Tier | Dependencies |",
		"|---------|------|-------------|",
	];

	for (const pkg of meta.packages.sort((a, b) => a.tier.localeCompare(b.tier))) {
		const deps =
			pkg.dependencies.length > 0
				? pkg.dependencies.map((d) => d.replace("@ctrl/", "")).join(", ")
				: "—";
		lines.push(`| ${pkg.name} | ${pkg.tier} | ${deps} |`);
	}

	lines.push(
		"",
		`## Services (${meta.services.length})`,
		"",
		"| Service | Package | Requires | Methods |",
		"|---------|---------|----------|---------|",
	);

	for (const svc of meta.services.sort((a, b) => a.tier.localeCompare(b.tier))) {
		const requires = svc.requires.length > 0 ? svc.requires.join(", ") : "—";
		const methods = svc.methods.length > 0 ? svc.methods.join(", ") : "—";
		lines.push(`| ${svc.name} | ${svc.package} | ${requires} | ${methods} |`);
	}

	lines.push(
		"",
		`## Event Catalog (${meta.events.length})`,
		"",
		"| Event/Command | Payload | Response |",
		"|--------------|---------|----------|",
	);

	for (const event of meta.events) {
		const payload =
			event.payloadFields.length > 0
				? event.payloadFields.map((f) => `${f.name}: ${f.type}`).join(", ")
				: "—";
		lines.push(`| ${event.tag} | ${payload} | ${event.successType} |`);
	}

	lines.push("", `## Layer Graph (${meta.layers.length})`, "");

	for (const layer of meta.layers) {
		const requires =
			layer.requires.length > 0 ? `requires [${layer.requires.join(", ")}]` : "no dependencies";
		lines.push(`- **${layer.provider}** provides ${layer.provides}, ${requires}`);
	}

	lines.push("");
	return lines.join("\n");
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
	const project = new Project({
		tsConfigFilePath: resolve(ROOT, "tsconfig.json"),
		skipAddingFilesFromTsConfig: true,
	});

	const libDirs = readdirSync(LIBS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
	for (const dir of libDirs) {
		const srcDir = resolve(LIBS_DIR, dir.name, "src");
		if (existsSync(srcDir)) {
			project.addSourceFilesAtPaths(resolve(srcDir, "**/*.ts"));
		}
	}

	const packages = scanPackages();
	const services = parseContextTags(project);
	const events = parseEventGroups(project);
	const layers = parseLayers(project, services);

	const metadata: AppMetadata = {
		generatedAt: new Date().toISOString(),
		packages,
		services,
		events,
		layers,
	};

	const format = process.argv.includes("--format=markdown") ? "markdown" : "json";
	const output =
		format === "markdown" ? generateMarkdown(metadata) : JSON.stringify(metadata, null, 2);
	process.stdout.write(`${output}\n`);
}

main();
