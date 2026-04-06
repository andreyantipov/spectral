import { type AppEvent, EventBus } from "@ctrl/arch.contract.event-bus";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { Effect, Layer, Stream } from "effect";

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
					}
					if (event.name === "diag.screenshot-result" && screenshotResolver) {
						screenshotResolver(event.payload);
						screenshotResolver = null;
					}
				}),
			),
		);

		const registerTools = (mcp: McpServer) => {
			mcp.registerTool("dispatch", { description: "Send a command to EventBus" }, async (extra) => {
				const args =
					(extra as unknown as { params: { arguments?: Record<string, unknown> } }).params
						.arguments ?? {};
				const action = args.action as string;
				const payload = (args.payload ?? {}) as Record<string, unknown>;
				await Effect.runPromise(
					bus.send({ type: "command", action, payload, meta: { source: "agent" } }),
				);
				await new Promise((r) => setTimeout(r, 200));
				return { content: [{ type: "text" as const, text: JSON.stringify({ ok: true, action }) }] };
			});

			mcp.registerTool("get_state", { description: "Get current application state" }, async () => ({
				content: [{ type: "text" as const, text: JSON.stringify(latestState, null, 2) }],
			}));

			mcp.registerTool(
				"get_events",
				{ description: "Get recent EventBus events" },
				async (extra) => {
					const args =
						(extra as unknown as { params: { arguments?: Record<string, unknown> } }).params
							.arguments ?? {};
					const limit = (args.limit as number) ?? 20;
					return {
						content: [
							{ type: "text" as const, text: JSON.stringify(recentEvents.slice(-limit), null, 2) },
						],
					};
				},
			);

			mcp.registerTool(
				"get_screenshot",
				{ description: "Capture app screenshot" },
				async (extra) => {
					const args =
						(extra as unknown as { params: { arguments?: Record<string, unknown> } }).params
							.arguments ?? {};
					const selector = args.selector as string | undefined;
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
						return { content: [{ type: "image" as const, data: base64, mimeType: "image/png" }] };
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

		yield* Effect.logInfo(`[MCP] Server listening on http://localhost:${MCP_PORT}/mcp`);

		yield* Effect.addFinalizer(() =>
			Effect.sync(() => {
				for (const t of transports.values()) t.close();
				transports.clear();
				server.stop();
			}),
		);
	}),
);
