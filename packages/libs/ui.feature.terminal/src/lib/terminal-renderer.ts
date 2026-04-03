import { GlyphAtlas } from "./glyph-atlas";
import { BG_FRAGMENT, BG_VERTEX, FG_FRAGMENT, FG_VERTEX } from "./shaders";
import type { CellGrid, CursorState } from "./types";

// Unit quad: two triangles covering [0,0]-[1,1]
const QUAD_VERTICES = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);

const BG_FLOATS_PER_INSTANCE = 5; // cellPos(2) + bgColor(3)
const FG_FLOATS_PER_INSTANCE = 9; // cellPos(2) + fgColor(3) + atlasUV(4)

function requireGL<T>(value: T | null, name: string): T {
	if (value === null) throw new Error(`WebGL resource unavailable: ${name}`);
	return value;
}

function compileShader(gl: WebGL2RenderingContext, source: string, type: GLenum): WebGLShader {
	const shader = gl.createShader(type);
	if (!shader) throw new Error("Failed to create shader");
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const info = gl.getShaderInfoLog(shader);
		gl.deleteShader(shader);
		throw new Error(`Shader compilation failed: ${info}`);
	}
	return shader;
}

function linkProgram(gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string): WebGLProgram {
	const vert = compileShader(gl, vertSrc, gl.VERTEX_SHADER);
	const frag = compileShader(gl, fragSrc, gl.FRAGMENT_SHADER);
	const program = gl.createProgram();
	if (!program) throw new Error("Failed to create program");
	gl.attachShader(program, vert);
	gl.attachShader(program, frag);
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const info = gl.getProgramInfoLog(program);
		gl.deleteProgram(program);
		throw new Error(`Program link failed: ${info}`);
	}
	// Shaders can be detached after linking
	gl.detachShader(program, vert);
	gl.detachShader(program, frag);
	gl.deleteShader(vert);
	gl.deleteShader(frag);
	return program;
}

type BgLocations = {
	a_position: number;
	a_cellPos: number;
	a_bgColor: number;
	u_cellSize: WebGLUniformLocation;
	u_resolution: WebGLUniformLocation;
};

type FgLocations = {
	a_position: number;
	a_cellPos: number;
	a_fgColor: number;
	a_atlasUV: number;
	u_cellSize: WebGLUniformLocation;
	u_resolution: WebGLUniformLocation;
	u_atlasSize: WebGLUniformLocation;
	u_atlas: WebGLUniformLocation;
};

export class TerminalRenderer {
	readonly atlas: GlyphAtlas;

	private gl: WebGL2RenderingContext;
	private bgProgram: WebGLProgram;
	private fgProgram: WebGLProgram;
	private bgLoc: BgLocations;
	private fgLoc: FgLocations;

	private quadVBO: WebGLBuffer;
	private bgInstanceVBO: WebGLBuffer;
	private fgInstanceVBO: WebGLBuffer;
	private bgVAO: WebGLVertexArrayObject;
	private fgVAO: WebGLVertexArrayObject;
	private atlasTexture: WebGLTexture;

	private cols = 0;
	private rows = 0;

	constructor(canvas: HTMLCanvasElement, opts: { fontSize: number; fontFamily: string }) {
		const gl = canvas.getContext("webgl2", { alpha: false, antialias: false });
		if (!gl) throw new Error("WebGL 2 not available");
		this.gl = gl;

		this.atlas = new GlyphAtlas(opts);

		// Compile programs
		this.bgProgram = linkProgram(gl, BG_VERTEX, BG_FRAGMENT);
		this.fgProgram = linkProgram(gl, FG_VERTEX, FG_FRAGMENT);

		// Resolve locations
		this.bgLoc = {
			a_position: gl.getAttribLocation(this.bgProgram, "a_position"),
			a_cellPos: gl.getAttribLocation(this.bgProgram, "a_cellPos"),
			a_bgColor: gl.getAttribLocation(this.bgProgram, "a_bgColor"),
			u_cellSize: requireGL(gl.getUniformLocation(this.bgProgram, "u_cellSize"), "u_cellSize"),
			u_resolution: requireGL(
				gl.getUniformLocation(this.bgProgram, "u_resolution"),
				"u_resolution",
			),
		};

		this.fgLoc = {
			a_position: gl.getAttribLocation(this.fgProgram, "a_position"),
			a_cellPos: gl.getAttribLocation(this.fgProgram, "a_cellPos"),
			a_fgColor: gl.getAttribLocation(this.fgProgram, "a_fgColor"),
			a_atlasUV: gl.getAttribLocation(this.fgProgram, "a_atlasUV"),
			u_cellSize: requireGL(gl.getUniformLocation(this.fgProgram, "u_cellSize"), "u_cellSize"),
			u_resolution: requireGL(
				gl.getUniformLocation(this.fgProgram, "u_resolution"),
				"u_resolution",
			),
			u_atlasSize: requireGL(gl.getUniformLocation(this.fgProgram, "u_atlasSize"), "u_atlasSize"),
			u_atlas: requireGL(gl.getUniformLocation(this.fgProgram, "u_atlas"), "u_atlas"),
		};

		// Shared quad VBO
		this.quadVBO = requireGL(gl.createBuffer(), "quadVBO");
		gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
		gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW);

		// Instance VBOs (pre-allocated, grown on demand)
		this.bgInstanceVBO = requireGL(gl.createBuffer(), "bgInstanceVBO");
		this.fgInstanceVBO = requireGL(gl.createBuffer(), "fgInstanceVBO");

		// VAOs
		this.bgVAO = this.createBgVAO();
		this.fgVAO = this.createFgVAO();

		// Atlas texture
		this.atlasTexture = requireGL(gl.createTexture(), "atlasTexture");
		gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	}

	resize(cols: number, rows: number): void {
		this.cols = cols;
		this.rows = rows;
		const canvas = this.gl.canvas as HTMLCanvasElement;
		canvas.width = cols * this.atlas.cellWidth;
		canvas.height = rows * this.atlas.cellHeight;
		this.gl.viewport(0, 0, canvas.width, canvas.height);
	}

	render(grid: CellGrid, _dirtyRows: Set<number> | null, cursor: CursorState): void {
		const gl = this.gl;
		const { cellWidth, cellHeight } = this.atlas;
		const canvas = gl.canvas as HTMLCanvasElement;

		// Upload latest atlas texture
		gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.atlas.getTexture());

		gl.clearColor(0, 0, 0, 1);
		gl.clear(gl.COLOR_BUFFER_BIT);

		const { bgData, bgCount, fgData, fgCount } = this.buildInstanceData(grid, cursor);

		// Pass 1: Backgrounds
		gl.useProgram(this.bgProgram);
		gl.uniform2f(this.bgLoc.u_cellSize, cellWidth, cellHeight);
		gl.uniform2f(this.bgLoc.u_resolution, canvas.width, canvas.height);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.bgInstanceVBO);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			bgData.subarray(0, bgCount * BG_FLOATS_PER_INSTANCE),
			gl.DYNAMIC_DRAW,
		);

		gl.bindVertexArray(this.bgVAO);
		gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, bgCount);

		// Pass 2: Foreground glyphs with blending
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

		gl.useProgram(this.fgProgram);
		gl.uniform2f(this.fgLoc.u_cellSize, cellWidth, cellHeight);
		gl.uniform2f(this.fgLoc.u_resolution, canvas.width, canvas.height);
		gl.uniform2f(this.fgLoc.u_atlasSize, 1024, 1024);
		gl.uniform1i(this.fgLoc.u_atlas, 0);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.fgInstanceVBO);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			fgData.subarray(0, fgCount * FG_FLOATS_PER_INSTANCE),
			gl.DYNAMIC_DRAW,
		);

		gl.bindVertexArray(this.fgVAO);
		gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, fgCount);

		gl.disable(gl.BLEND);
		gl.bindVertexArray(null);
	}

	dispose(): void {
		const gl = this.gl;
		gl.deleteBuffer(this.quadVBO);
		gl.deleteBuffer(this.bgInstanceVBO);
		gl.deleteBuffer(this.fgInstanceVBO);
		gl.deleteVertexArray(this.bgVAO);
		gl.deleteVertexArray(this.fgVAO);
		gl.deleteTexture(this.atlasTexture);
		gl.deleteProgram(this.bgProgram);
		gl.deleteProgram(this.fgProgram);
	}

	// --- Instance data building ---

	private buildInstanceData(
		grid: CellGrid,
		cursor: CursorState,
	): { bgData: Float32Array; bgCount: number; fgData: Float32Array; fgCount: number } {
		const totalCells = grid.cols * grid.rows;
		const bgData = new Float32Array(totalCells * BG_FLOATS_PER_INSTANCE);
		const fgData = new Float32Array(totalCells * FG_FLOATS_PER_INSTANCE);
		let bgCount = 0;
		let fgCount = 0;

		for (let row = 0; row < grid.rows; row++) {
			const rowCells = grid.cells[row];
			if (!rowCells) continue;

			for (let col = 0; col < grid.cols; col++) {
				const cell = rowCells[col];
				if (!cell) continue;

				const bgOff = bgCount * BG_FLOATS_PER_INSTANCE;
				bgData[bgOff] = col;
				bgData[bgOff + 1] = row;
				bgData[bgOff + 2] = cell.bg[0] / 255;
				bgData[bgOff + 3] = cell.bg[1] / 255;
				bgData[bgOff + 4] = cell.bg[2] / 255;
				bgCount++;

				const hasGlyph = cell.char !== "" && cell.char !== " ";
				if (hasGlyph) {
					const uv = this.atlas.getGlyph(cell.char, cell.bold, cell.italic);
					const fgOff = fgCount * FG_FLOATS_PER_INSTANCE;
					fgData[fgOff] = col;
					fgData[fgOff + 1] = row;
					fgData[fgOff + 2] = cell.fg[0] / 255;
					fgData[fgOff + 3] = cell.fg[1] / 255;
					fgData[fgOff + 4] = cell.fg[2] / 255;
					fgData[fgOff + 5] = uv.u;
					fgData[fgOff + 6] = uv.v;
					fgData[fgOff + 7] = uv.w;
					fgData[fgOff + 8] = uv.h;
					fgCount++;
				}
			}
		}

		bgCount = this.appendCursorInstance(grid, cursor, bgData, bgCount);
		return { bgData, bgCount, fgData, fgCount };
	}

	private appendCursorInstance(
		grid: CellGrid,
		cursor: CursorState,
		bgData: Float32Array,
		bgCount: number,
	): number {
		if (!cursor.visible || cursor.row >= grid.rows || cursor.col >= grid.cols) {
			return bgCount;
		}
		const cursorRow = grid.cells[cursor.row];
		const cursorCell = cursorRow?.[cursor.col];
		if (!cursorCell) return bgCount;

		const bgOff = bgCount * BG_FLOATS_PER_INSTANCE;
		bgData[bgOff] = cursor.col;
		bgData[bgOff + 1] = cursor.row;
		bgData[bgOff + 2] = cursorCell.fg[0] / 255;
		bgData[bgOff + 3] = cursorCell.fg[1] / 255;
		bgData[bgOff + 4] = cursorCell.fg[2] / 255;
		return bgCount + 1;
	}

	// --- VAO setup ---

	private createBgVAO(): WebGLVertexArrayObject {
		const gl = this.gl;
		const vao = requireGL(gl.createVertexArray(), "bgVAO");
		gl.bindVertexArray(vao);

		const stride = BG_FLOATS_PER_INSTANCE * 4;

		// Quad vertices (per-vertex, divisor 0)
		gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
		gl.enableVertexAttribArray(this.bgLoc.a_position);
		gl.vertexAttribPointer(this.bgLoc.a_position, 2, gl.FLOAT, false, 0, 0);

		// Instance data (divisor 1)
		gl.bindBuffer(gl.ARRAY_BUFFER, this.bgInstanceVBO);

		// a_cellPos: 2 floats at offset 0
		gl.enableVertexAttribArray(this.bgLoc.a_cellPos);
		gl.vertexAttribPointer(this.bgLoc.a_cellPos, 2, gl.FLOAT, false, stride, 0);
		gl.vertexAttribDivisor(this.bgLoc.a_cellPos, 1);

		// a_bgColor: 3 floats at offset 8
		gl.enableVertexAttribArray(this.bgLoc.a_bgColor);
		gl.vertexAttribPointer(this.bgLoc.a_bgColor, 3, gl.FLOAT, false, stride, 2 * 4);
		gl.vertexAttribDivisor(this.bgLoc.a_bgColor, 1);

		gl.bindVertexArray(null);
		return vao;
	}

	private createFgVAO(): WebGLVertexArrayObject {
		const gl = this.gl;
		const vao = requireGL(gl.createVertexArray(), "fgVAO");
		gl.bindVertexArray(vao);

		const stride = FG_FLOATS_PER_INSTANCE * 4;

		// Quad vertices (per-vertex, divisor 0)
		gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
		gl.enableVertexAttribArray(this.fgLoc.a_position);
		gl.vertexAttribPointer(this.fgLoc.a_position, 2, gl.FLOAT, false, 0, 0);

		// Instance data (divisor 1)
		gl.bindBuffer(gl.ARRAY_BUFFER, this.fgInstanceVBO);

		// a_cellPos: 2 floats at offset 0
		gl.enableVertexAttribArray(this.fgLoc.a_cellPos);
		gl.vertexAttribPointer(this.fgLoc.a_cellPos, 2, gl.FLOAT, false, stride, 0);
		gl.vertexAttribDivisor(this.fgLoc.a_cellPos, 1);

		// a_fgColor: 3 floats at offset 8
		gl.enableVertexAttribArray(this.fgLoc.a_fgColor);
		gl.vertexAttribPointer(this.fgLoc.a_fgColor, 3, gl.FLOAT, false, stride, 2 * 4);
		gl.vertexAttribDivisor(this.fgLoc.a_fgColor, 1);

		// a_atlasUV: 4 floats at offset 20
		gl.enableVertexAttribArray(this.fgLoc.a_atlasUV);
		gl.vertexAttribPointer(this.fgLoc.a_atlasUV, 4, gl.FLOAT, false, stride, 5 * 4);
		gl.vertexAttribDivisor(this.fgLoc.a_atlasUV, 1);

		gl.bindVertexArray(null);
		return vao;
	}
}
