import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import { Spec } from "./builder";

class Start extends Schema.TaggedClass<Start>()("Start", { instanceId: Schema.String }) {}
class Stop extends Schema.TaggedClass<Stop>()("Stop", { instanceId: Schema.String }) {}
class DoWork extends Schema.TaggedClass<DoWork>()("DoWork", { instanceId: Schema.String }) {}

describe("Spec.make builder", () => {
	it("builds a valid spec object", () => {
		const spec = Spec.make("test-spec", { mode: "instance", domain: "test", version: 1 })
			.initial("idle")
			.triggers(Start)
			.terminalOn(Stop)
			.state("idle", (s) => s.on(DoWork, "working", { effects: ["do.work"] }))
			.state("working", (s) => s.on(Stop, "stopped"))
			.state("stopped")
			.build();

		expect(spec.id).toBe("test-spec");
		expect(spec.initial).toBe("idle");
		expect(spec.triggers).toEqual(["Start"]);
		expect(spec.terminalOn).toEqual(["Stop"]);
		expect(spec.states.idle.on?.DoWork.target).toBe("working");
		expect(spec.states.idle.on?.DoWork.effects).toEqual(["do.work"]);
	});

	it("is JSON serializable", () => {
		const spec = Spec.make("s", { mode: "instance", domain: "d", version: 1 })
			.initial("a")
			.triggers(Start)
			.terminalOn(Stop)
			.state("a", (s) => s.on(DoWork, "a", { guards: ["g"], effects: ["e"], compensate: ["c"] }))
			.build();
		const json = JSON.parse(JSON.stringify(spec));
		expect(json.states.a.on.DoWork.compensate).toEqual(["c"]);
	});

	it("validates initial state exists", () => {
		expect(() =>
			Spec.make("bad", { mode: "instance", domain: "d", version: 1 })
				.initial("nonexistent")
				.triggers(Start)
				.terminalOn(Stop)
				.state("idle")
				.build(),
		).toThrow(/nonexistent/);
	});

	it("validates transition targets exist", () => {
		expect(() =>
			Spec.make("bad", { mode: "instance", domain: "d", version: 1 })
				.initial("idle")
				.triggers(Start)
				.terminalOn(Stop)
				.state("idle", (s) => s.on(DoWork, "nonexistent"))
				.build(),
		).toThrow(/nonexistent/);
	});

	it("supports empty states (terminal)", () => {
		const spec = Spec.make("s", { mode: "instance", domain: "d", version: 1 })
			.initial("a")
			.triggers(Start)
			.terminalOn(Stop)
			.state("a", (s) => s.on(Stop, "b"))
			.state("b")
			.build();
		expect(spec.states.b).toEqual({});
	});

	it("supports multiple triggers", () => {
		const spec = Spec.make("s", { mode: "instance", domain: "d", version: 1 })
			.initial("a")
			.triggers(Start, DoWork)
			.terminalOn(Stop)
			.state("a")
			.build();
		expect(spec.triggers).toEqual(["Start", "DoWork"]);
	});

	it("supports multiple transitions in one state", () => {
		const spec = Spec.make("s", { mode: "instance", domain: "d", version: 1 })
			.initial("a")
			.triggers(Start)
			.terminalOn(Stop)
			.state("a", (s) => s.on(DoWork, "b").on(Stop, "c"))
			.state("b")
			.state("c")
			.build();
		expect(spec.states.a.on?.DoWork.target).toBe("b");
		expect(spec.states.a.on?.Stop.target).toBe("c");
	});
});
