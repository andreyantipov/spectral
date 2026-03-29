/**
 * Reads metadata.json and generates EventCatalog filesystem using @eventcatalog/sdk.
 *
 * Usage: bun run packages/tools/generate-catalog.ts
 */

import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import catalogFactory from "@eventcatalog/sdk";

const ROOT = resolve(import.meta.dir, "../..");
const METADATA_PATH = resolve(ROOT, "metadata.json");
const CATALOG_DIR = process.argv[2]
	? resolve(process.cwd(), process.argv[2])
	: resolve(ROOT, "packages/apps/dev-docs");

type EventMeta = {
	tag: string;
	group: string;
	primaryKey: string;
	payloadFields: Array<{ name: string; type: string }>;
	successType: string;
};

type ServiceMeta = {
	name: string;
	tagId: string;
	package: string;
	methods: string[];
	requires: string[];
	providedBy: string;
};

type AppMetadata = {
	generatedAt: string;
	services: ServiceMeta[];
	events: EventMeta[];
};

const COMMAND_ACTIONS = new Set([
	"create",
	"close",
	"activate",
	"navigate",
	"add",
	"remove",
	"report",
	"update",
	"back",
	"forward",
]);

function isCommand(tag: string): boolean {
	const parts = tag.split(".");
	const action = parts[parts.length - 1];
	return COMMAND_ACTIONS.has(action) || [...COMMAND_ACTIONS].some((a) => action.includes(a));
}

const DOMAINS = [
	{
		id: "Browsing",
		services: ["SessionFeature", "BookmarkFeature", "HistoryFeature", "OmniboxFeature"],
	},
	{ id: "Workspace", services: ["LayoutFeature"] },
	{ id: "Infrastructure", services: ["EventBus", "DatabaseService"] },
];

function cleanCatalog() {
	for (const dir of ["domains", "services", "commands", "events"]) {
		const fullPath = resolve(CATALOG_DIR, dir);
		if (existsSync(fullPath)) rmSync(fullPath, { recursive: true });
	}
}

async function writeDomains(
	sdk: ReturnType<typeof catalogFactory>,
	meta: AppMetadata,
	version: string,
) {
	for (const domain of DOMAINS) {
		await sdk.writeDomain({
			id: domain.id,
			name: domain.id,
			version,
			markdown: `Domain containing ${domain.services.join(", ")} services.`,
		});

		for (const svcName of domain.services) {
			const svc = meta.services.find((s) => s.name === svcName);
			if (!svc) continue;

			await sdk.writeService({
				id: svc.name,
				name: svc.name,
				version,
				markdown: `**Package:** \`${svc.package}\`\n\n**Methods:** ${svc.methods.join(", ") || "none"}\n\n**Requires:** ${svc.requires.join(", ") || "none"}\n\n**Provided by:** ${svc.providedBy || "none"}`,
			});

			await sdk.addServiceToDomain(domain.id, { id: svc.name, version });
		}
	}
}

async function writeEvents(
	sdk: ReturnType<typeof catalogFactory>,
	meta: AppMetadata,
	version: string,
) {
	for (const event of meta.events) {
		const payload = event.payloadFields.map((f) => `- \`${f.name}\`: ${f.type}`).join("\n");
		const markdown = `**Group:** ${event.group}\n\n**Primary Key:** \`${event.primaryKey}\`\n\n**Payload:**\n${payload || "none"}\n\n**Response:** ${event.successType}`;

		if (isCommand(event.tag)) {
			await sdk.writeCommand({ id: event.tag, name: event.tag, version, markdown });
		} else {
			await sdk.writeEvent({ id: event.tag, name: event.tag, version, markdown });
		}
	}
}

async function main() {
	if (!existsSync(METADATA_PATH)) {
		process.stderr.write("metadata.json not found. Run: bun run docs:meta\n");
		process.exit(1);
	}

	cleanCatalog();

	const sdk = catalogFactory(CATALOG_DIR);
	const meta: AppMetadata = JSON.parse(readFileSync(METADATA_PATH, "utf-8"));
	const rootPkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8"));
	const version = rootPkg.version;

	await writeDomains(sdk, meta, version);
	await writeEvents(sdk, meta, version);

	process.stdout.write(
		`EventCatalog generated: ${DOMAINS.length} domains, ${meta.services.length} services, ${meta.events.length} events/commands\n`,
	);
}

main();
