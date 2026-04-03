import type { Cell, CellGrid, CursorState } from "./types";

/**
 * VT Parser wrapping libghostty-vt WASM.
 *
 * The WASM binary provides terminal emulation (VT100/xterm parsing)
 * and exposes render state as a flat array of 16-byte cells.
 *
 * Cell layout (16 bytes each):
 *   [0..3]  uint32 LE: codepoint (Unicode)
 *   [4]     uint8: fg_r
 *   [5]     uint8: fg_g
 *   [6]     uint8: fg_b
 *   [7]     uint8: bg_r
 *   [8]     uint8: bg_g
 *   [9]     uint8: bg_b
 *   [10]    uint8: flags (bit 0=bold, bit 1=italic, bit 2=underline)
 *   [11]    uint8: width (1=normal, 2=wide)
 *   [12..13] uint16 LE: hyperlink_id
 *   [14]    uint8: grapheme_len
 */

const CELL_SIZE = 16;

const FLAG_BOLD = 1;
const FLAG_ITALIC = 2;
const FLAG_UNDERLINE = 4;

// Default theme colors when WASM returns 0,0,0
const DEFAULT_FG: [number, number, number] = [224, 224, 224]; // #e0e0e0
const DEFAULT_BG: [number, number, number] = [15, 15, 35]; // #0f0f23

function isDefaultColor(r: number, g: number, b: number): boolean {
	return r === 0 && g === 0 && b === 0;
}

function parseCell(view: DataView, offset: number): Cell {
	const codepoint = view.getUint32(offset, true);
	const char = codepoint === 0 ? " " : String.fromCodePoint(codepoint);

	const fgR = view.getUint8(offset + 4);
	const fgG = view.getUint8(offset + 5);
	const fgB = view.getUint8(offset + 6);
	const bgR = view.getUint8(offset + 7);
	const bgG = view.getUint8(offset + 8);
	const bgB = view.getUint8(offset + 9);
	const flags = view.getUint8(offset + 10);

	const fg: [number, number, number] = isDefaultColor(fgR, fgG, fgB) ? DEFAULT_FG : [fgR, fgG, fgB];
	const bg: [number, number, number] = isDefaultColor(bgR, bgG, bgB) ? DEFAULT_BG : [bgR, bgG, bgB];

	return {
		char,
		fg,
		bg,
		bold: (flags & FLAG_BOLD) !== 0,
		italic: (flags & FLAG_ITALIC) !== 0,
		underline: (flags & FLAG_UNDERLINE) !== 0,
	};
}

export class VtParser {
	private wasm: WebAssembly.Instance | null = null;
	private memory: WebAssembly.Memory | null = null;
	private terminal: number = 0; // opaque WASM pointer
	private _cols: number;
	private _rows: number;
	private viewportBufPtr: number = 0;
	private viewportBufLen: number = 0;

	private constructor(wasm: WebAssembly.Instance, cols: number, rows: number) {
		this.wasm = wasm;
		this.memory = wasm.exports.memory as WebAssembly.Memory;
		this._cols = cols;
		this._rows = rows;

		const newTerminal = wasm.exports.ghostty_terminal_new as CallableFunction;
		if (newTerminal) {
			this.terminal = newTerminal(cols, rows);
		}

		this.allocViewportBuffer();
	}

	static async load(wasmUrl: string, cols = 80, rows = 24): Promise<VtParser> {
		const response = await fetch(wasmUrl);
		const bytes = await response.arrayBuffer();
		const result = await WebAssembly.instantiate(bytes, {
			env: {
				log: (_ptr: number, _len: number) => {
					// Logging callback from WASM
				},
			},
		});
		return new VtParser(result.instance, cols, rows);
	}

	/** Feed raw PTY output bytes to the terminal parser */
	feed(data: Uint8Array): void {
		if (!this.wasm || !this.memory) return;

		const exports = this.wasm.exports;
		const alloc = exports.ghostty_wasm_alloc_u8_array as CallableFunction;
		const free = exports.ghostty_wasm_free_u8_array as CallableFunction;
		const write = exports.ghostty_terminal_write as CallableFunction;

		if (!alloc || !write) return;

		const ptr = alloc(data.byteLength);
		// Re-read memory.buffer after alloc (may have grown)
		const wasmMem = new Uint8Array(this.memory.buffer, ptr, data.byteLength);
		wasmMem.set(data);
		write(this.terminal, ptr, data.byteLength);
		if (free) free(ptr, data.byteLength);
	}

	/** Get the current terminal grid state */
	getGrid(): CellGrid {
		if (!this.wasm || !this.memory) {
			return this.emptyGrid();
		}

		const exports = this.wasm.exports;
		const update = exports.ghostty_render_state_update as CallableFunction;
		const getViewport = exports.ghostty_render_state_get_viewport as CallableFunction;

		if (update) update(this.terminal);

		if (!getViewport) {
			return this.emptyGrid();
		}

		const cellCount = this._cols * this._rows;
		const result = getViewport(this.terminal, this.viewportBufPtr, cellCount);
		if (result < 0) {
			return this.emptyGrid();
		}

		// Re-read memory.buffer (may have been detached after WASM calls)
		const view = new DataView(this.memory.buffer, this.viewportBufPtr, cellCount * CELL_SIZE);
		return this.parseViewport(view);
	}

	/** Get set of rows that changed since last call */
	getDirtyRows(): Set<number> {
		if (!this.wasm) return new Set();

		const exports = this.wasm.exports;
		const isDirty = exports.ghostty_render_state_is_row_dirty as CallableFunction;
		const markClean = exports.ghostty_render_state_mark_clean as CallableFunction;

		if (!isDirty) {
			const all = new Set<number>();
			for (let r = 0; r < this._rows; r++) all.add(r);
			return all;
		}

		const dirty = new Set<number>();
		for (let r = 0; r < this._rows; r++) {
			if (isDirty(this.terminal, r)) {
				dirty.add(r);
			}
		}
		if (markClean) markClean(this.terminal);
		return dirty;
	}

	/** Get cursor position and visibility */
	getCursor(): CursorState {
		if (!this.wasm) return { row: 0, col: 0, visible: true };

		const exports = this.wasm.exports;
		const getX = exports.ghostty_render_state_get_cursor_x as CallableFunction;
		const getY = exports.ghostty_render_state_get_cursor_y as CallableFunction;
		const getVisible = exports.ghostty_render_state_get_cursor_visible as CallableFunction;

		return {
			col: getX ? getX(this.terminal) : 0,
			row: getY ? getY(this.terminal) : 0,
			visible: getVisible ? Boolean(getVisible(this.terminal)) : true,
		};
	}

	/** Resize the terminal */
	resize(cols: number, rows: number): void {
		this._cols = cols;
		this._rows = rows;
		if (!this.wasm) return;

		const resizeFn = this.wasm.exports.ghostty_terminal_resize as CallableFunction;
		if (resizeFn) resizeFn(this.terminal, cols, rows);

		// Free old buffer and allocate new one for the new dimensions
		this.freeViewportBuffer();
		this.allocViewportBuffer();
	}

	/** Clean up WASM resources */
	dispose(): void {
		if (!this.wasm) return;
		this.freeViewportBuffer();
		const free = this.wasm.exports.ghostty_terminal_free as CallableFunction;
		if (free && this.terminal) free(this.terminal);
		this.terminal = 0;
		this.wasm = null;
		this.memory = null;
	}

	private parseViewport(view: DataView): CellGrid {
		const cells: Cell[][] = [];
		for (let r = 0; r < this._rows; r++) {
			const row: Cell[] = [];
			for (let c = 0; c < this._cols; c++) {
				const offset = (r * this._cols + c) * CELL_SIZE;
				row.push(parseCell(view, offset));
			}
			cells.push(row);
		}
		return { cols: this._cols, rows: this._rows, cells };
	}

	private allocViewportBuffer(): void {
		if (!this.wasm) return;
		const alloc = this.wasm.exports.ghostty_wasm_alloc_u8_array as CallableFunction;
		if (!alloc) return;

		const byteLen = this._cols * this._rows * CELL_SIZE;
		this.viewportBufPtr = alloc(byteLen);
		this.viewportBufLen = byteLen;
	}

	private freeViewportBuffer(): void {
		if (!this.wasm || this.viewportBufPtr === 0) return;
		const free = this.wasm.exports.ghostty_wasm_free_u8_array as CallableFunction;
		if (free) free(this.viewportBufPtr, this.viewportBufLen);
		this.viewportBufPtr = 0;
		this.viewportBufLen = 0;
	}

	private emptyGrid(): CellGrid {
		const cells: Cell[][] = [];
		for (let r = 0; r < this._rows; r++) {
			const row: Cell[] = [];
			for (let c = 0; c < this._cols; c++) {
				row.push({
					char: " ",
					fg: DEFAULT_FG,
					bg: DEFAULT_BG,
					bold: false,
					italic: false,
					underline: false,
				});
			}
			cells.push(row);
		}
		return { cols: this._cols, rows: this._rows, cells };
	}
}
