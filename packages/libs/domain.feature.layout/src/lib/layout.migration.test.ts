import { describe, expect, it } from "vitest";
import { bootstrapDefaultLayout } from "./layout.migration";

describe("Layout Migration", () => {
	it("creates single-pane layout from active session", () => {
		const layout = bootstrapDefaultLayout("session-123");
		expect(layout.type).toBe("group");
		expect(layout.panels).toHaveLength(1);
		expect(layout.panels[0].entityId).toBe("session-123");
		expect(layout.activePanel).toBe(layout.panels[0].id);
	});

	it("creates empty group when no active session", () => {
		const layout = bootstrapDefaultLayout(undefined);
		expect(layout.type).toBe("group");
		expect(layout.panels).toHaveLength(0);
	});
});
