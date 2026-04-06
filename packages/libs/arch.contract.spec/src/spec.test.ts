import { describe, expect, it } from "bun:test";
import type { BuiltSpec, Spec, StateNode, Transition } from "./spec";

describe("Spec", () => {
	const makeSpec = (): Spec => ({
		id: "web-session",
		version: 1,
		domain: "browsing",
		mode: "instance",
		initial: "idle",
		triggers: ["session.create", "nav.navigate"],
		terminalOn: ["session.close"],
		states: {
			idle: { on: { "session.create": { target: "active", effects: ["createTab"] } } },
			active: {
				on: {
					"nav.navigate": { target: "active", guards: ["isValidUrl"], effects: ["navigate"] },
					"session.close": { target: "closed", effects: ["cleanup"] },
				},
			},
			closed: {},
		},
		onStart: ["initSession"],
		onStop: ["teardown"],
		effectKeys: new Set(["createTab", "navigate", "cleanup", "initSession", "teardown"]),
		emitKeys: new Set(["browsing.snapshot"]),
		guardKeys: new Set(["isValidUrl"]),
		actionTags: new Set(["session.create", "nav.navigate", "session.close"]),
	});

	it("constructs a well-formed Spec with Sets", () => {
		const spec = makeSpec();
		expect(spec.id).toBe("web-session");
		expect(spec.mode).toBe("instance");
		expect(spec.initial).toBe("idle");
		expect(spec.effectKeys.has("createTab")).toBe(true);
		expect(spec.guardKeys.has("isValidUrl")).toBe(true);
		expect(spec.emitKeys.has("browsing.snapshot")).toBe(true);
		expect(spec.actionTags.size).toBe(3);
	});

	it("is JSON-serializable (Sets need conversion)", () => {
		const spec = makeSpec();

		// Sets are NOT natively JSON-serializable — they serialize to {}
		const raw = JSON.parse(JSON.stringify(spec));
		expect(raw.effectKeys).toEqual({}); // Set becomes empty object

		// Proper serialization requires explicit conversion
		const serializable = {
			...spec,
			effectKeys: [...spec.effectKeys],
			emitKeys: [...spec.emitKeys],
			guardKeys: [...spec.guardKeys],
			actionTags: [...spec.actionTags],
		};
		const json = JSON.parse(JSON.stringify(serializable));
		expect(json.effectKeys).toEqual([
			"createTab",
			"navigate",
			"cleanup",
			"initSession",
			"teardown",
		]);
		expect(json.emitKeys).toEqual(["browsing.snapshot"]);
		expect(json.guardKeys).toEqual(["isValidUrl"]);
		expect(json.actionTags).toEqual(["session.create", "nav.navigate", "session.close"]);
		expect(json.states.idle.on["session.create"].target).toBe("active");
	});

	it("supports singleton mode", () => {
		const spec: Spec = {
			id: "manager",
			version: 1,
			domain: "system",
			mode: "singleton",
			initial: "ready",
			triggers: [],
			terminalOn: [],
			states: { ready: {} },
			effectKeys: new Set(),
			emitKeys: new Set(),
			guardKeys: new Set(),
			actionTags: new Set(),
		};
		expect(spec.mode).toBe("singleton");
		expect(spec.effectKeys.size).toBe(0);
	});

	it("supports transitions with guards and effects", () => {
		const t: Transition = { target: "next", guards: ["g1", "g2"], effects: ["e1"] };
		expect(t.guards).toEqual(["g1", "g2"]);
		expect(t.effects).toEqual(["e1"]);
	});

	it("supports minimal transitions (target only)", () => {
		const t: Transition = { target: "done" };
		expect(t.guards).toBeUndefined();
		expect(t.effects).toBeUndefined();
	});

	it("supports empty StateNode", () => {
		const node: StateNode = {};
		expect(node.on).toBeUndefined();
	});
});

describe("BuiltSpec", () => {
	it("extends Spec with actions and implement", () => {
		const builtSpec: BuiltSpec = {
			id: "test",
			version: 1,
			domain: "test",
			mode: "instance",
			initial: "idle",
			triggers: [],
			terminalOn: [],
			states: { idle: {} },
			effectKeys: new Set(),
			emitKeys: new Set(),
			guardKeys: new Set(),
			actionTags: new Set(),
			actions: {
				"session.create": { _tag: "session.create", make: (p: unknown) => p },
			},
			implement: (handlers) => handlers,
		};
		expect(builtSpec.actions["session.create"]._tag).toBe("session.create");
		expect(builtSpec.implement({ foo: () => {} })).toHaveProperty("foo");
	});
});
