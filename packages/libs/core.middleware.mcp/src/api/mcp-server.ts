import { type AppEvent, EventBus } from "@ctrl/core.contract.event-bus";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Effect, Layer, Stream } from "effect";

const MCP_PORT = 50100;
const MAX_EVENTS = 100;

export const McpServerLive = Layer.scopedDiscard(
	Effect.gen(function* () {
		const bus = yield* EventBus;

		const recentEvents: Array<AppEvent & { _receivedAt: number }> = [];
		let latestBrowsingSnapshot: unknown = null;
		let latestWorkspaceSnapshot: unknown = null;

		yield* Effect.forkScoped(
			Stream.runForEach(bus.events, (event) =>
				Effect.sync(() => {
					recentEvents.push({ ...event, _receivedAt: Date.now() });
					if (recentEvents.length > MAX_EVENTS) recentEvents.shift();
					if (event.name === "browsing.snapshot") latestBrowsingSnapshot = event.payload;
					if (event.name === "workspace.snapshot") latestWorkspaceSnapshot = event.payload;
				}),
			),
		);

		yield* bus.send({
			type: "command",
			action: "state.request",
			payload: {},
			meta: { source: "agent" },
		});

		const mcp = new McpServer({ name: "spectral", version: "0.1.0" });

		mcp.tool(
			"dispatch",
			"Send a command to EventBus. Payload is validated by EventBus handlers.",
			async (params) => {
				const { action, payload } = params as unknown as {
					action: string;
					payload?: Record<string, unknown>;
				};
				await Effect.runPromise(
					bus.send({ type: "command", action, payload: payload ?? {}, meta: { source: "agent" } }),
				);
				await new Promise((r) => setTimeout(r, 200));
				return { content: [{ type: "text" as const, text: JSON.stringify({ ok: true, action }) }] };
			},
		);

		mcp.tool("get_state", "Get current application state (sessions + layout)", async () => {
			await Effect.runPromise(
				bus.send({
					type: "command",
					action: "state.request",
					payload: {},
					meta: { source: "agent" },
				}),
			);
			await new Promise((r) => setTimeout(r, 200));
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{ browsing: latestBrowsingSnapshot, workspace: latestWorkspaceSnapshot },
							null,
							2,
						),
					},
				],
			};
		});

		mcp.tool("get_events", "Get recent EventBus events", async (params) => {
			const { limit } = params as unknown as { limit?: number };
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(recentEvents.slice(-(limit ?? 20)), null, 2),
					},
				],
			};
		});

		const transport = new WebStandardStreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
		});

		const server = Bun.serve({
			port: MCP_PORT,
			fetch: (req) => {
				const url = new URL(req.url);
				if (url.pathname === "/mcp") return transport.handleRequest(req);
				return new Response("MCP endpoint: /mcp", { status: 404 });
			},
		});

		yield* Effect.promise(() => mcp.connect(transport));

		yield* Effect.addFinalizer(() =>
			Effect.sync(() => {
				server.stop();
			}),
		);
	}),
);
