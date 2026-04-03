import type { Cell, CellGrid, CursorState } from "./types";

/**
 * VT Parser wrapping libghostty-vt WASM.
 *
 * The WASM binary provides terminal emulation (VT100/xterm parsing)
 * and exposes render state (grid of cells with attributes).
 *
 * Note: This is a scaffold. The WASM FFI details (pointer arithmetic,
 * memory layout for graphemes/colors) need refinement against the actual
 * WASM binary. The public API is stable.
 */
export class VtParser {
	private wasm: WebAssembly.Instance | null = null;
	private memory: WebAssembly.Memory | null = null;
	private terminal: number = 0; // opaque WASM pointer
	private _cols: number;
	private _rows: number;

	private constructor(wasm: WebAssembly.Instance, cols: number, rows: number) {
		this.wasm = wasm;
		this.memory = wasm.exports.memory as WebAssembly.Memory;
		this._cols = cols;
		this._rows = rows;

		const newTerminal = wasm.exports.ghostty_terminal_new as CallableFunction;
		if (newTerminal) {
			this.terminal = newTerminal(cols, rows);
		}
	}

	static async load(wasmUrl: string, cols = 80, rows = 24): Promise<VtParser> {
		const response = await fetch(wasmUrl);
		const bytes = await response.arrayBuffer();
		const result = await WebAssembly.instantiate(bytes, {
			env: {
				log: (_ptr: number, _len: number) => {
					// Logging callback — can be wired to console.log if needed
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

		// Allocate WASM memory, copy data, call write, free
		const ptr = alloc(data.byteLength);
		const wasmMem = new Uint8Array(this.memory.buffer, ptr, data.byteLength);
		wasmMem.set(data);
		write(this.terminal, ptr, data.byteLength);
		if (free) free(ptr, data.byteLength);
	}

	/** Get the current terminal grid state */
	getGrid(): CellGrid {
		if (!this.wasm) {
			return this.emptyGrid();
		}

		const exports = this.wasm.exports;
		const update = exports.ghostty_render_state_update as CallableFunction;
		const _getGrapheme = exports.ghostty_render_state_get_grapheme as CallableFunction;
		const _getFgColor = exports.ghostty_render_state_get_fg_color as CallableFunction;
		const _getBgColor = exports.ghostty_render_state_get_bg_color as CallableFunction;

		if (update) update(this.terminal);

		const cells: Cell[][] = [];
		for (let r = 0; r < this._rows; r++) {
			const row: Cell[] = [];
			for (let c = 0; c < this._cols; c++) {
				// Default cell — will be populated from WASM when FFI is refined
				const char = " ";
				const fg: [number, number, number] = [255, 255, 255];
				const bg: [number, number, number] = [0, 0, 0];

				// TODO: Read actual grapheme and color from WASM memory.
				// The exact pointer arithmetic depends on WASM memory layout
				// which needs testing against the actual binary.

				row.push({ char, fg, bg, bold: false, italic: false, underline: false });
			}
			cells.push(row);
		}

		return { cols: this._cols, rows: this._rows, cells };
	}

	/** Get set of rows that changed since last call */
	getDirtyRows(): Set<number> {
		if (!this.wasm) return new Set();

		const exports = this.wasm.exports;
		const isDirty = exports.ghostty_render_state_is_row_dirty as CallableFunction;
		const markClean = exports.ghostty_render_state_mark_clean as CallableFunction;

		if (!isDirty) {
			// If dirty tracking unavailable, return all rows
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
	}

	/** Clean up WASM resources */
	dispose(): void {
		if (!this.wasm) return;
		const free = this.wasm.exports.ghostty_terminal_free as CallableFunction;
		if (free && this.terminal) free(this.terminal);
		this.terminal = 0;
		this.wasm = null;
		this.memory = null;
	}

	private emptyGrid(): CellGrid {
		const cells: Cell[][] = [];
		for (let r = 0; r < this._rows; r++) {
			const row: Cell[] = [];
			for (let c = 0; c < this._cols; c++) {
				row.push({
					char: " ",
					fg: [255, 255, 255],
					bg: [0, 0, 0],
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
