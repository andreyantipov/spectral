/**
 * Standalone terminal demo server.
 *
 * Run: cd packages/libs/ui.feature.terminal && bun run demo/server.ts
 * Open: http://localhost:3456
 */

import type { Subprocess } from "bun";

const HTML_PATH = new URL("./index.html", import.meta.url).pathname;
const WASM_PATH = new URL("../../vendor/libghostty-vt.wasm", import.meta.url).pathname;

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
						// Send PTY output to browser
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
				// String message = keyboard input
				proc.terminal.write(message);
			} else if (message instanceof Buffer || message instanceof Uint8Array) {
				// Binary message = resize command (4 bytes: cols_hi, cols_lo, rows_hi, rows_lo)
				if (message.byteLength === 4) {
					const view = new DataView(message instanceof Buffer ? message.buffer : message.buffer);
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
╔══════════════════════════════════════════╗
║  Spectral Terminal Demo                  ║
║  http://localhost:${server.port}                   ║
║  Press Ctrl+C to stop                    ║
╚══════════════════════════════════════════╝
`);
