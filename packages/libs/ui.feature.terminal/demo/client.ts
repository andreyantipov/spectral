/**
 * Terminal demo client — browser entry point.
 *
 * Pipeline: Bun.Terminal -> WebSocket -> libghostty-vt.wasm (VtParser) -> WebGL 2 (TerminalRenderer)
 */

import { encodeKey } from "../src/lib/encode-key";
import { TerminalRenderer } from "../src/lib/terminal-renderer";
import { VtParser } from "../src/lib/vt-parser";

const COLS = 120;
const ROWS = 30;
const FONT_SIZE = 14;
const FONT_FAMILY = "monospace";

const canvas = document.getElementById("terminal") as HTMLCanvasElement;
const statusEl = document.getElementById("status") as HTMLDivElement;

function setStatus(text: string): void {
	statusEl.textContent = text;
}

async function main(): Promise<void> {
	setStatus("Loading WASM...");

	let parser: VtParser;
	try {
		parser = await VtParser.load("/libghostty-vt.wasm", COLS, ROWS);
	} catch (err) {
		setStatus(`WASM load failed: ${err}`);
		return;
	}

	setStatus("Initializing renderer...");

	const renderer = new TerminalRenderer(canvas, {
		fontSize: FONT_SIZE,
		fontFamily: FONT_FAMILY,
	});
	renderer.resize(COLS, ROWS);

	// Initial render of empty grid
	const emptyGrid = parser.getGrid();
	const cursor = parser.getCursor();
	renderer.render(emptyGrid, null, cursor);

	setStatus("Connecting...");

	const ws = new WebSocket(`ws://${location.host}/ws`);
	ws.binaryType = "arraybuffer";

	let needsRender = false;

	function renderFrame(): void {
		if (needsRender) {
			needsRender = false;
			const grid = parser.getGrid();
			const dirtyRows = parser.getDirtyRows();
			const cur = parser.getCursor();
			renderer.render(grid, dirtyRows, cur);
		}
		requestAnimationFrame(renderFrame);
	}
	requestAnimationFrame(renderFrame);

	ws.onopen = () => {
		setStatus(`Connected | ${COLS}x${ROWS} | libghostty-vt.wasm + WebGL 2`);

		// Send initial terminal size
		const buf = new ArrayBuffer(4);
		const view = new DataView(buf);
		view.setUint16(0, COLS);
		view.setUint16(2, ROWS);
		ws.send(buf);
	};

	ws.onmessage = (event: MessageEvent) => {
		const data = new Uint8Array(event.data as ArrayBuffer);
		parser.feed(data);
		needsRender = true;
	};

	ws.onclose = () => setStatus("Disconnected");
	ws.onerror = () => setStatus("Connection error");

	// Keyboard input
	document.addEventListener("keydown", (e: KeyboardEvent) => {
		if (!ws || ws.readyState !== WebSocket.OPEN) return;
		e.preventDefault();

		const encoded = encodeKey(e);
		if (encoded !== null) {
			ws.send(encoded);
		}
	});

	// Focus canvas for keyboard events
	canvas.tabIndex = 0;
	canvas.focus();
	canvas.addEventListener("click", () => canvas.focus());
}

main();
