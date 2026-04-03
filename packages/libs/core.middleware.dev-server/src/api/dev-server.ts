import { type AppEvent, EventBus } from "@ctrl/core.contract.event-bus";
import { Effect, Layer, Stream } from "effect";

const DEV_SERVER_PORT = 50100;
const MAX_EVENTS = 50;

export const DevServerLive = Layer.scopedDiscard(
	Effect.gen(function* () {
		const bus = yield* EventBus;

		// Ring buffer for recent events (captures snapshots too)
		const recentEvents: Array<AppEvent & { readonly _receivedAt: number }> = [];
		// Latest snapshots captured from event stream
		let latestBrowsingSnapshot: unknown = null;
		let latestWorkspaceSnapshot: unknown = null;

		// Subscribe to all events — fork a background fiber
		yield* Effect.forkScoped(
			Stream.runForEach(bus.events, (event) =>
				Effect.sync(() => {
					recentEvents.push({ ...event, _receivedAt: Date.now() });
					if (recentEvents.length > MAX_EVENTS) recentEvents.shift();
					// Capture latest snapshots
					if (event.name === "browsing.snapshot") latestBrowsingSnapshot = event.payload;
					if (event.name === "workspace.snapshot") latestWorkspaceSnapshot = event.payload;
				}),
			),
		);

		// Request initial state
		yield* bus.send({
			type: "command",
			action: "state.request",
			payload: {},
			meta: { source: "agent" },
		});

		const json = (data: unknown, status = 200) =>
			Response.json(data, {
				status,
				headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
			});

		const routes: Record<string, (req: Request) => Promise<Response> | Response> = {
			"GET /health": () => json({ ok: true, port: DEV_SERVER_PORT }),
			"GET /state/sessions": () =>
				json({
					sessions: (latestBrowsingSnapshot as { sessions?: unknown } | null)?.sessions ?? [],
				}),
			"GET /state/layout": () =>
				json({ layout: (latestWorkspaceSnapshot as { root?: unknown } | null)?.root ?? null }),
			"GET /state": () =>
				json({ browsing: latestBrowsingSnapshot, workspace: latestWorkspaceSnapshot }),
			"GET /events": () => json({ events: recentEvents }),
			"POST /dispatch": async (req) => {
				const body = (await req.json()) as { action: string; payload?: unknown };
				if (!body.action) return json({ error: "action required" }, 400);
				await Effect.runPromise(
					bus.send({
						type: "command",
						action: body.action,
						payload: body.payload ?? {},
						meta: { source: "agent" },
					}),
				);
				return json({ ok: true, action: body.action });
			},
		};

		const server = Bun.serve({
			port: DEV_SERVER_PORT,
			fetch: async (req) => {
				if (req.method === "OPTIONS") {
					return new Response(null, {
						headers: {
							"Access-Control-Allow-Origin": "*",
							"Access-Control-Allow-Methods": "GET,POST",
							"Access-Control-Allow-Headers": "Content-Type",
						},
					});
				}
				const key = `${req.method} ${new URL(req.url).pathname}`;
				const handler = routes[key];
				if (!handler) return json({ error: "not found" }, 404);
				try {
					return await handler(req);
				} catch (err) {
					return json({ error: String(err) }, 500);
				}
			},
		});

		console.info(`[bun] DevServer started at http://localhost:${DEV_SERVER_PORT}`);

		yield* Effect.addFinalizer(() =>
			Effect.sync(() => {
				server.stop();
				console.info("[bun] DevServer stopped");
			}),
		);
	}),
);
