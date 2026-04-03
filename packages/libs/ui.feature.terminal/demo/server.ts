/**
 * Standalone terminal demo server.
 *
 * Run: cd packages/libs/ui.feature.terminal && bun run demo/server.ts
 * Open: http://localhost:3456
 */

import type { Subprocess } from "bun";

const HTML_PATH = new URL("./index.html", import.meta.url).pathname;
const BUILD_DIR = new URL("./build", import.meta.url).pathname;
const WASM_PATH = new URL("../../../vendor/libghostty-vt.wasm", import.meta.url).pathname;

// Build client bundle on startup
console.error("[demo] Building client bundle...");
const buildResult = await Bun.build({
	entrypoints: [new URL("./client.ts", import.meta.url).pathname],
	outdir: BUILD_DIR,
	minify: false,
	target: "browser",
});

if (!buildResult.success) {
	console.error("[demo] Build failed:");
	for (const log of buildResult.logs) {
		console.error("  ", log);
	}
	process.exit(1);
}
console.error("[demo] Client bundle built successfully.");

// Track PTY processes per WebSocket connection
const processes = new WeakMap<object, Subprocess>();

// Serve static files
const server = Bun.serve({
	port: 3456,
	async fetch(req, server) {
		const url = new URL(req.url);

		// WebSocket upgrade
		if (url.pathname === "/ws") {
			if (server.upgrade(req)) return;
			return new Response("WebSocket upgrade failed", { status: 400 });
		}

		// Serve HTML
		if (url.pathname === "/" || url.pathname === "/index.html") {
			return new Response(Bun.file(HTML_PATH), {
				headers: { "Content-Type": "text/html" },
			});
		}

		// Serve built client JS
		if (url.pathname === "/build/client.js") {
			return new Response(Bun.file(`${BUILD_DIR}/client.js`), {
				headers: { "Content-Type": "application/javascript" },
			});
		}

		// Serve WASM
		if (url.pathname === "/libghostty-vt.wasm") {
			return new Response(Bun.file(WASM_PATH), {
				headers: { "Content-Type": "application/wasm" },
			});
		}

		return new Response("Not found", { status: 404 });
	},
	websocket: {
		open(ws) {
			console.error("[demo] WebSocket connected, spawning PTY...");

			const proc = Bun.spawn([process.env.SHELL ?? "/bin/sh"], {
				cwd: process.cwd(),
				terminal: {
					cols: 80,
					rows: 24,
					data(_terminal, data) {
						try {
							ws.sendBinary(new Uint8Array(data));
						} catch {
							// WebSocket might be closed
						}
					},
					exit() {
						console.error("[demo] PTY exited");
						ws.close();
					},
				},
			});

			processes.set(ws, proc);
			console.error("[demo] PTY spawned, shell:", process.env.SHELL ?? "/bin/sh");
		},
		message(ws, message) {
			const proc = processes.get(ws);
			if (!proc?.terminal) return;

			if (typeof message === "string") {
				proc.terminal.write(message);
			} else if (message instanceof Buffer || message instanceof Uint8Array) {
				// Binary message = resize command (4 bytes: cols_hi, cols_lo, rows_hi, rows_lo)
				if (message.byteLength === 4) {
					const view = new DataView(message.buffer, message.byteOffset, message.byteLength);
					const cols = view.getUint16(0);
					const rows = view.getUint16(2);
					proc.terminal.resize(cols, rows);
					console.error(`[demo] Resized to ${cols}x${rows}`);
				}
			}
		},
		close(ws) {
			const proc = processes.get(ws);
			if (proc) {
				proc.terminal?.close();
				proc.kill();
				processes.delete(ws);
			}
			console.error("[demo] WebSocket closed");
		},
	},
});

console.error(`
╔══════════════════════════════════════════════════════════════╗
║  Spectral Terminal Demo                                      ║
║  http://localhost:${server.port}                                       ║
║  Pipeline: Bun.Terminal → WS → libghostty-vt.wasm → WebGL 2 ║
║  Press Ctrl+C to stop                                        ║
╚══════════════════════════════════════════════════════════════╝
`);
