import { describe, expect, it } from "bun:test";
import { FeatureRegistry } from "@ctrl/arch.contract.feature-registry";
import { SpecRegistry } from "@ctrl/arch.contract.spec-registry";
import { SpecRunnerInternal } from "@ctrl/arch.impl.spec-runner";
import { WebSession } from "@ctrl/base.spec.web-session";
import { EventBus } from "@ctrl/core.contract.event-bus";
import { Effect } from "effect";
import { TestSpecEngineLive, TestSpecEngineWithBusLive } from "./test-layer";

describe("FSM Integration", () => {
	it("CreateSession -> Navigate -> UrlCommitted -> CloseSession", async () => {
		const log: string[] = [];

		await Effect.gen(function* () {
			const reg = yield* FeatureRegistry;
			const runner = yield* SpecRunnerInternal;

			yield* reg.register("InsertSession", (p) => {
				log.push(`create:${(p as { instanceId?: string }).instanceId}`);
				return Effect.void;
			});
			yield* reg.register("ActivateSession", (p) => {
				log.push(`activate:${(p as { instanceId?: string }).instanceId}`);
				return Effect.void;
			});
			yield* reg.register("StartNavigation", (p) => {
				log.push(`nav:${(p as { url?: string }).url}`);
				return Effect.void;
			});
			yield* reg.register("UrlIsValid", (p) =>
				Effect.succeed(
					typeof (p as { url?: string }).url === "string" &&
						(p as { url?: string }).url?.startsWith("http"),
				),
			);
			yield* reg.register("WriteUrl", () => {
				log.push("url");
				return Effect.void;
			});
			yield* reg.register("WriteTitle", () => {
				log.push("title");
				return Effect.void;
			});
			yield* reg.register("WriteFavicon", () => {
				log.push("favicon");
				return Effect.void;
			});
			yield* reg.register("RecordHistory", () => {
				log.push("history");
				return Effect.void;
			});
			yield* reg.register("RemoveSession", () => {
				log.push("close");
				return Effect.void;
			});
			yield* reg.register("SetError", () => Effect.void);

			yield* runner.registerSpec(WebSession);
			yield* runner.spawn("web-session", "t1");

			// idle -> browsing
			yield* runner.dispatch("t1", {
				_tag: "CreateSession",
				instanceId: "t1",
				mode: "visual",
			});
			yield* Effect.sleep("100 millis");
			expect(log).toContain("create:t1");

			// browsing -> loading
			yield* runner.dispatch("t1", {
				_tag: "Navigate",
				instanceId: "t1",
				url: "https://google.com",
			});
			yield* Effect.sleep("100 millis");
			expect(log).toContain("nav:https://google.com");

			// loading -> browsing
			yield* runner.dispatch("t1", {
				_tag: "UrlCommitted",
				instanceId: "t1",
				url: "https://google.com",
				title: "Google",
				favicon: "x",
			});
			yield* Effect.sleep("100 millis");
			expect(log).toContain("url");
			expect(log).toContain("title");
			expect(log).toContain("history");

			// browsing -> closed
			yield* runner.dispatch("t1", {
				_tag: "CloseSession",
				instanceId: "t1",
			});
			yield* Effect.sleep("100 millis");
			expect(log).toContain("close");
		}).pipe(Effect.scoped, Effect.provide(TestSpecEngineLive), Effect.runPromise);
	});

	it("Navigate with invalid URL is blocked by guard", async () => {
		const log: string[] = [];

		await Effect.gen(function* () {
			const reg = yield* FeatureRegistry;
			const runner = yield* SpecRunnerInternal;

			yield* reg.register("InsertSession", () => Effect.void);
			yield* reg.register("StartNavigation", () => {
				log.push("nav");
				return Effect.void;
			});
			yield* reg.register("UrlIsValid", (p) =>
				Effect.succeed(
					typeof (p as { url?: string }).url === "string" &&
						(p as { url?: string }).url?.startsWith("http"),
				),
			);
			yield* reg.register("WriteUrl", () => Effect.void);
			yield* reg.register("ActivateSession", () => Effect.void);
			yield* reg.register("RemoveSession", () => Effect.void);
			yield* reg.register("SetError", () => Effect.void);

			yield* runner.registerSpec(WebSession);
			yield* runner.spawn("web-session", "t1");

			yield* runner.dispatch("t1", {
				_tag: "CreateSession",
				instanceId: "t1",
				mode: "visual",
			});
			yield* Effect.sleep("50 millis");

			// Invalid URL — guard should block
			yield* runner.dispatch("t1", {
				_tag: "Navigate",
				instanceId: "t1",
				url: "not-a-url",
			});
			yield* Effect.sleep("50 millis");

			expect(log).not.toContain("nav");
		}).pipe(Effect.scoped, Effect.provide(TestSpecEngineLive), Effect.runPromise);
	});

	it("two tabs run independently", async () => {
		const log: string[] = [];

		await Effect.gen(function* () {
			const reg = yield* FeatureRegistry;
			const runner = yield* SpecRunnerInternal;

			yield* reg.register("InsertSession", (p) => {
				log.push(`create:${(p as { instanceId?: string }).instanceId}`);
				return Effect.void;
			});
			yield* reg.register("StartNavigation", (p) => {
				const payload = p as { instanceId?: string; url?: string };
				log.push(`nav:${payload.instanceId}:${payload.url}`);
				return Effect.void;
			});
			yield* reg.register("UrlIsValid", () => Effect.succeed(true));
			yield* reg.register("WriteUrl", () => Effect.void);
			yield* reg.register("ActivateSession", () => Effect.void);
			yield* reg.register("RemoveSession", () => Effect.void);
			yield* reg.register("SetError", () => Effect.void);

			yield* runner.registerSpec(WebSession);
			yield* runner.spawn("web-session", "t1");
			yield* runner.spawn("web-session", "t2");

			yield* runner.dispatch("t1", {
				_tag: "CreateSession",
				instanceId: "t1",
				mode: "visual",
			});
			yield* runner.dispatch("t2", {
				_tag: "CreateSession",
				instanceId: "t2",
				mode: "visual",
			});
			yield* Effect.sleep("100 millis");

			yield* runner.dispatch("t1", {
				_tag: "Navigate",
				instanceId: "t1",
				url: "https://a.com",
			});
			yield* runner.dispatch("t2", {
				_tag: "Navigate",
				instanceId: "t2",
				url: "https://b.com",
			});
			yield* Effect.sleep("100 millis");

			expect(log).toContain("create:t1");
			expect(log).toContain("create:t2");
			expect(log).toContain("nav:t1:https://a.com");
			expect(log).toContain("nav:t2:https://b.com");
		}).pipe(Effect.scoped, Effect.provide(TestSpecEngineLive), Effect.runPromise);
	});

	it("action invalid for current state is dropped", async () => {
		const log: string[] = [];

		await Effect.gen(function* () {
			const reg = yield* FeatureRegistry;
			const runner = yield* SpecRunnerInternal;

			yield* reg.register("InsertSession", () => Effect.void);
			yield* reg.register("RemoveSession", () => {
				log.push("close");
				return Effect.void;
			});
			yield* reg.register("WriteUrl", () => Effect.void);
			yield* reg.register("ActivateSession", () => Effect.void);
			yield* reg.register("SetError", () => Effect.void);

			yield* runner.registerSpec(WebSession);
			yield* runner.spawn("web-session", "t1");

			// CloseSession from idle — not valid, should be dropped
			yield* runner.dispatch("t1", {
				_tag: "CloseSession",
				instanceId: "t1",
			});
			yield* Effect.sleep("50 millis");

			expect(log).not.toContain("close");
		}).pipe(Effect.scoped, Effect.provide(TestSpecEngineLive), Effect.runPromise);
	});

	it("SpecRegistry routes trigger action to spawn + dispatch", async () => {
		const log: string[] = [];

		await Effect.gen(function* () {
			const reg = yield* FeatureRegistry;
			const specReg = yield* SpecRegistry;
			const bus = yield* EventBus;

			yield* reg.register("InsertSession", (p) => {
				log.push(`create:${(p as { instanceId?: string }).instanceId}`);
				return Effect.void;
			});
			yield* reg.register("UrlIsValid", () => Effect.succeed(true));
			yield* reg.register("StartNavigation", () => Effect.void);
			yield* reg.register("WriteUrl", () => Effect.void);
			yield* reg.register("ActivateSession", () => Effect.void);
			yield* reg.register("RemoveSession", () => Effect.void);
			yield* reg.register("SetError", () => Effect.void);

			yield* specReg.register(WebSession);
			yield* Effect.sleep("50 millis");

			// Dispatch via EventBus — SpecRegistry should route
			yield* bus.send({
				type: "command",
				action: "CreateSession",
				payload: { mode: "visual" },
				meta: { source: "ui" },
			});
			yield* Effect.sleep("200 millis");

			// Should have spawned an instance and run InsertSession effect
			expect(log.some((l) => l.startsWith("create:"))).toBe(true);
		}).pipe(Effect.scoped, Effect.provide(TestSpecEngineWithBusLive), Effect.runPromise);
	});
});
