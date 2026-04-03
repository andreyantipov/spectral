import { onCleanup, onMount } from "solid-js";
import { encodeKey } from "../lib/encode-key";
import { TerminalRenderer } from "../lib/terminal-renderer";
import { VtParser } from "../lib/vt-parser";

export type TerminalPanelProps = {
	terminalId: string;
	wasmUrl: string;
	onWrite: (id: string, data: string) => void;
	onResize: (id: string, cols: number, rows: number) => void;
	outputStream: AsyncIterable<Uint8Array>;
};

export function TerminalPanel(props: TerminalPanelProps) {
	let canvasRef!: HTMLCanvasElement;
	let renderer: TerminalRenderer | null = null;
	let parser: VtParser | null = null;
	let disposed = false;

	const handleKeyDown = (e: KeyboardEvent) => {
		const encoded = encodeKey(e);
		if (encoded) {
			e.preventDefault();
			props.onWrite(props.terminalId, encoded);
		}
	};

	const consumeOutput = async () => {
		try {
			for await (const data of props.outputStream) {
				if (disposed || !parser || !renderer) break;
				parser.feed(data);
				const grid = parser.getGrid();
				const dirtyRows = parser.getDirtyRows();
				const cursor = parser.getCursor();
				renderer.render(grid, dirtyRows, cursor);
			}
		} catch (err) {
			if (!disposed) {
				console.error("[terminal] Output stream error:", err);
			}
		}
	};

	onMount(async () => {
		try {
			parser = await VtParser.load(props.wasmUrl);
			renderer = new TerminalRenderer(canvasRef, {
				fontSize: 14,
				fontFamily: "monospace",
			});

			// Calculate initial grid size
			const rect = canvasRef.getBoundingClientRect();
			const cols = Math.max(1, Math.floor(rect.width / renderer.atlas.cellWidth));
			const rows = Math.max(1, Math.floor(rect.height / renderer.atlas.cellHeight));
			parser.resize(cols, rows);
			renderer.resize(cols, rows);
			props.onResize(props.terminalId, cols, rows);

			// Keyboard input
			canvasRef.addEventListener("keydown", handleKeyDown);

			// Consume output stream
			consumeOutput();
		} catch (err) {
			console.error("[terminal] Failed to initialize:", err);
		}
	});

	// Resize observer
	onMount(() => {
		const observer = new ResizeObserver(() => {
			if (!renderer || !parser) return;
			const rect = canvasRef.getBoundingClientRect();
			const cols = Math.max(1, Math.floor(rect.width / renderer.atlas.cellWidth));
			const rows = Math.max(1, Math.floor(rect.height / renderer.atlas.cellHeight));
			parser.resize(cols, rows);
			renderer.resize(cols, rows);
			props.onResize(props.terminalId, cols, rows);
		});
		observer.observe(canvasRef);
		onCleanup(() => observer.disconnect());
	});

	onCleanup(() => {
		disposed = true;
		canvasRef?.removeEventListener("keydown", handleKeyDown);
		renderer?.dispose();
		parser?.dispose();
	});

	return (
		<canvas
			ref={canvasRef!}
			class="terminal-canvas"
			tabIndex={0}
			style={{ width: "100%", height: "100%", display: "block", outline: "none" }}
		/>
	);
}
