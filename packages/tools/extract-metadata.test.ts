import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("extract-metadata", () => {
	it("produces valid metadata with expected structure", () => {
		const output = execSync("bun run packages/tools/extract-metadata.ts", {
			encoding: "utf-8",
			timeout: 30_000,
		});
		const meta = JSON.parse(output);

		expect(meta.packages.length).toBeGreaterThanOrEqual(20);
		expect(meta.services.length).toBeGreaterThanOrEqual(5);
		expect(meta.events.length).toBeGreaterThanOrEqual(5);
		expect(meta.layers.length).toBeGreaterThanOrEqual(3);

		// Key services exist
		const serviceNames = meta.services.map((s: { name: string }) => s.name);
		expect(serviceNames).toContain("SessionFeature");
		expect(serviceNames).toContain("EventBus");
		expect(serviceNames).toContain("BookmarkFeature");
		expect(serviceNames).toContain("HistoryFeature");

		// Services have methods
		const session = meta.services.find((s: { name: string }) => s.name === "SessionFeature");
		expect(session.methods).toContain("create");
		expect(session.methods).toContain("navigate");

		// Key events exist
		const eventTags = meta.events.map((e: { tag: string }) => e.tag);
		expect(eventTags).toContain("session.create");
		expect(eventTags).toContain("nav.navigate");
		expect(eventTags).toContain("bm.add");

		// All 10 events present
		expect(eventTags).toContain("session.activate");
		expect(eventTags).toContain("nav.update-title");
		expect(eventTags).toContain("bm.remove");

		// Layers wire correctly
		const sessionLayer = meta.layers.find(
			(l: { provider: string }) => l.provider === "SessionFeatureLive",
		);
		expect(sessionLayer).toBeDefined();
		expect(sessionLayer.provides).toBe("SessionFeature");
		expect(sessionLayer.requires).toContain("SessionRepository");

		// No test-only services
		expect(serviceNames).not.toContain("TestSpanExporter");
	});
});
