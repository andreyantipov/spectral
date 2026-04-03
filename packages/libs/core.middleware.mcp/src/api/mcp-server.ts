import { type AppEvent, EventBus } from "@ctrl/core.contract.event-bus";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { Effect, Layer, Stream } from "effect";
import { z } from "zod";

const MCP_PORT = 50100;
const MAX_EVENTS = 100;

export const McpServerLive = Layer.scopedDiscard(
	Effect.gen(function* () {
		const bus = yield* EventBus;

		const recentEvents: Array<AppEvent & { _receivedAt: number }> = [];
		let latestState: Record<string, unknown> = {};
		let screenshotResolver: ((payload: unknown) => void) | null = null;

		yield* Effect.forkScoped(
			Stream.runForEach(bus.events, (event) =>
				Effect.sync(() => {
					recentEvents.push({ ...event, _receivedAt: Date.now() });
					if (recentEvents.length > MAX_EVENTS) recentEvents.shift();
					if (event.name === "state-sync" && event.payload) {
						latestState = event.payload as Record<string, unknown>;
						console.info("[MCP] state-sync received, paths:", Object.keys(latestState));
					}
					if (event.name === "diag.screenshot-result" && screenshotResolver) {
						screenshotResolver(event.payload);
						screenshotResolver = null;
					}
				}),
			),
		);

		const registerTools = (mcpServer: McpServer) => {
			// Use Record-typed reference to avoid tsgo TS2589 (deep type instantiation with zod + MCP SDK generics)
			const mcp: Record<string, (...args: unknown[]) => unknown> = mcpServer as never;
			mcp.tool(
				"dispatch",
				"Send a command to EventBus. Payload is validated by EventBus handlers.",
				{ action: z.string(), payload: z.record(z.unknown()).optional() },
				async ({ action, payload }: { action: string; payload?: Record<string, unknown> }) => {
					await Effect.runPromise(
						bus.send({
							type: "command",
							action,
							payload: payload ?? {},
							meta: { source: "agent" },
						}),
					);
					await new Promise((r) => setTimeout(r, 200));
					return {
						content: [{ type: "text" as const, text: JSON.stringify({ ok: true, action }) }],
					};
				},
			);

			mcp.tool("get_state", "Get current application state (sessions + layout)", async () => ({
				content: [{ type: "text" as const, text: JSON.stringify(latestState, null, 2) }],
			}));

			mcp.tool(
				"get_events",
				"Get recent EventBus events",
				{ limit: z.number().optional() },
				async ({ limit }: { limit?: number }) => ({
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(recentEvents.slice(-(limit ?? 20)), null, 2),
						},
					],
				}),
			);

			mcp.tool(
				"get_screenshot",
				"Capture a screenshot of the app UI via EventBus diag.screenshot. Returns base64 PNG image.",
				{ selector: z.string().optional() },
				async ({ selector }: { selector?: string }) => {
					const TIMEOUT_MS = 5000;
					const resultPromise = new Promise<unknown>((resolve, reject) => {
						screenshotResolver = resolve;
						setTimeout(() => {
							if (screenshotResolver === resolve) {
								screenshotResolver = null;
								reject(new Error("Screenshot timed out"));
							}
						}, TIMEOUT_MS);
					});

					await Effect.runPromise(
						bus.send({
							type: "command",
							action: "diag.screenshot",
							payload: { selector },
							meta: { source: "agent" },
						}),
					);

					try {
						const result = (await resultPromise) as { data: string };
						return {
							content: [{ type: "image" as const, data: result.data, mimeType: "image/png" }],
						};
					} catch {
						// Fallback: use screencapture
						const path = "/tmp/spectral-screenshot.png";
						const proc = Bun.spawn(["screencapture", "-x", "-o", path], {
							stdout: "ignore",
							stderr: "ignore",
						});
						await proc.exited;
						const file = Bun.file(path);
						if (!(await file.exists())) {
							return { content: [{ type: "text" as const, text: "Screenshot failed" }] };
						}
						const bytes = await file.arrayBuffer();
						const base64 = Buffer.from(bytes).toString("base64");
						return {
							content: [{ type: "image" as const, data: base64, mimeType: "image/png" }],
						};
					}
				},
			);
		};

		// Per-session transport map (standard MCP multi-client pattern)
		const transports = new Map<string, WebStandardStreamableHTTPServerTransport>();

		const handleInitialize = async (req: Request) => {
			const body = await req.json();
			const messages = Array.isArray(body) ? body : [body];
			if (!messages.some(isInitializeRequest)) return null;
			const transport = new WebStandardStreamableHTTPServerTransport({
				sessionIdGenerator: () => crypto.randomUUID(),
				enableJsonResponse: true,
				onsessioninitialized: (sid) => {
					transports.set(sid, transport);
				},
			});
			transport.onclose = () => {
				const sid = transport.sessionId;
				if (sid) transports.delete(sid);
			};
			const mcp = new McpServer({ name: "spectral", version: "0.1.0" });
			registerTools(mcp);
			await mcp.connect(transport);
			return transport.handleRequest(req, { parsedBody: body });
		};

		const handleMcpRequest = async (req: Request): Promise<Response> => {
			const sessionId = req.headers.get("mcp-session-id");

			if (sessionId && transports.has(sessionId)) {
				const existing = transports.get(sessionId);
				if (existing) return existing.handleRequest(req);
			}

			if (req.method === "POST") {
				const result = await handleInitialize(req);
				if (result) return result;
			}

			if (req.method === "DELETE" && sessionId) {
				return new Response(null, { status: 404 });
			}

			return new Response(
				JSON.stringify({
					jsonrpc: "2.0",
					error: { code: -32000, message: "No valid session" },
					id: null,
				}),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			);
		};

		const server = Bun.serve({
			port: MCP_PORT,
			fetch: async (req) => {
				const url = new URL(req.url);
				if (url.pathname !== "/mcp") {
					return new Response("MCP endpoint: /mcp", { status: 404 });
				}
				return handleMcpRequest(req);
			},
		});

		console.info(`[MCP] Server listening on http://localhost:${MCP_PORT}/mcp`);

		yield* Effect.addFinalizer(() =>
			Effect.sync(() => {
				for (const t of transports.values()) t.close();
				transports.clear();
				server.stop();
			}),
		);
	}),
);
