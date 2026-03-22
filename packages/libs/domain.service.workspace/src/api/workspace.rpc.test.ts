import type { DatabaseError } from "@ctrl/core.base.errors";
import { LayoutRepository } from "@ctrl/core.shared";
import type { LayoutNode, PanelRef, PersistedLayout } from "@ctrl/domain.feature.layout";
import { LayoutFeatureLive } from "@ctrl/domain.feature.layout";
import { Headers } from "@effect/platform";
import { Effect, Layer, ManagedRuntime } from "effect";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { WorkspaceHandlersLive } from "./workspace.handlers";
import { WorkspaceRpcs } from "./workspace.rpc";

let storedLayout: { version: number; dockviewState: unknown } | null = null;

const MockLayoutRepository = Layer.succeed(LayoutRepository, {
	getLayout: () => Effect.succeed(storedLayout),
	saveLayout: (layout) =>
		Effect.sync(() => {
			storedLayout = layout;
		}),
});

const TestLayer = WorkspaceHandlersLive.pipe(
	Layer.provide(LayoutFeatureLive),
	Layer.provide(MockLayoutRepository),
);

const runtime = ManagedRuntime.make(TestLayer);

afterAll(() => runtime.dispose());

type HandlerFn<P, R> = (payload: P, headers: typeof Headers.empty) => R;

beforeEach(() => {
	storedLayout = null;
});

describe("WorkspaceRpcs", () => {
	it("getLayout returns default when no layout saved", async () => {
		const result = await runtime.runPromise(
			Effect.gen(function* () {
				const getLayout = yield* WorkspaceRpcs.accessHandler("getLayout");
				return yield* (
					getLayout as unknown as HandlerFn<undefined, Effect.Effect<LayoutNode, DatabaseError>>
				)(undefined, Headers.empty);
			}),
		);
		expect(result).toEqual({ type: "group", panels: [], activePanel: "" });
	});

	it("updateLayout persists and getLayout returns it", async () => {
		const layout: LayoutNode = {
			type: "group",
			panels: [{ id: "p1", type: "session", sessionId: "s1" }],
			activePanel: "p1",
		};
		const result = await runtime.runPromise(
			Effect.gen(function* () {
				const updateLayout = yield* WorkspaceRpcs.accessHandler("updateLayout");
				yield* (
					updateLayout as HandlerFn<{ layout: PersistedLayout }, Effect.Effect<void, DatabaseError>>
				)({ layout: { version: 1, dockviewState: layout } }, Headers.empty);

				const getLayout = yield* WorkspaceRpcs.accessHandler("getLayout");
				return yield* (
					getLayout as unknown as HandlerFn<undefined, Effect.Effect<LayoutNode, DatabaseError>>
				)(undefined, Headers.empty);
			}),
		);
		expect(result).toEqual(layout);
	});

	it("splitPanel creates a split node from a group", async () => {
		const initial: LayoutNode = {
			type: "group",
			panels: [{ id: "p1", type: "session", sessionId: "s1" }],
			activePanel: "p1",
		};
		storedLayout = { version: 1, dockviewState: initial };

		const result = await runtime.runPromise(
			Effect.gen(function* () {
				const splitPanel = yield* WorkspaceRpcs.accessHandler("splitPanel");
				yield* (
					splitPanel as HandlerFn<
						{
							panelId: string;
							direction: "horizontal" | "vertical";
							newPanel: PanelRef;
						},
						Effect.Effect<void, DatabaseError>
					>
				)(
					{
						panelId: "p1",
						direction: "horizontal",
						newPanel: { id: "p2", type: "session", sessionId: "s2" },
					},
					Headers.empty,
				);

				const getLayout = yield* WorkspaceRpcs.accessHandler("getLayout");
				return yield* (
					getLayout as unknown as HandlerFn<undefined, Effect.Effect<LayoutNode, DatabaseError>>
				)(undefined, Headers.empty);
			}),
		);
		expect(result.type).toBe("split");
		if (result.type === "split") {
			expect(result.direction).toBe("horizontal");
			expect(result.children).toHaveLength(2);
			expect(result.sizes).toEqual([0.5, 0.5]);
		}
	});

	it("closePanel removes a panel from the layout", async () => {
		const initial: LayoutNode = {
			type: "group",
			panels: [
				{ id: "p1", type: "session", sessionId: "s1" },
				{ id: "p2", type: "session", sessionId: "s2" },
			],
			activePanel: "p1",
		};
		storedLayout = { version: 1, dockviewState: initial };

		const result = await runtime.runPromise(
			Effect.gen(function* () {
				const closePanel = yield* WorkspaceRpcs.accessHandler("closePanel");
				yield* (closePanel as HandlerFn<{ panelId: string }, Effect.Effect<void, DatabaseError>>)(
					{ panelId: "p1" },
					Headers.empty,
				);

				const getLayout = yield* WorkspaceRpcs.accessHandler("getLayout");
				return yield* (
					getLayout as unknown as HandlerFn<undefined, Effect.Effect<LayoutNode, DatabaseError>>
				)(undefined, Headers.empty);
			}),
		);
		expect(result.type).toBe("group");
		if (result.type === "group") {
			expect(result.panels).toHaveLength(1);
			expect(result.panels[0].id).toBe("p2");
			expect(result.activePanel).toBe("p2");
		}
	});
});
