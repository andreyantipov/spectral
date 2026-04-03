import type { GlyphUV } from "./types";

type GlyphKey = string; // "char:bold:italic"

const makeKey = (char: string, bold: boolean, italic: boolean): GlyphKey =>
	`${char}:${bold ? 1 : 0}:${italic ? 1 : 0}`;

export class GlyphAtlas {
	readonly cellWidth: number;
	readonly cellHeight: number;

	private canvas: OffscreenCanvas;
	private ctx: OffscreenCanvasRenderingContext2D;
	private cache = new Map<GlyphKey, GlyphUV>();
	private shelfX = 0;
	private shelfY = 0;
	private shelfHeight = 0;
	private readonly atlasWidth = 1024;
	private readonly atlasHeight = 1024;
	private readonly fontSize: number;
	private readonly fontFamily: string;

	constructor(opts: { fontSize: number; fontFamily: string }) {
		this.fontSize = opts.fontSize;
		this.fontFamily = opts.fontFamily;
		this.canvas = new OffscreenCanvas(this.atlasWidth, this.atlasHeight);
		const ctx = this.canvas.getContext("2d");
		if (!ctx) throw new Error("Failed to get 2D context from OffscreenCanvas");
		this.ctx = ctx;

		// Measure cell dimensions from a reference character
		this.ctx.font = `${this.fontSize}px ${this.fontFamily}`;
		const metrics = this.ctx.measureText("M");
		this.cellWidth = Math.ceil(metrics.width);
		this.cellHeight = Math.ceil(this.fontSize * 1.2);
	}

	getGlyph(char: string, bold: boolean, italic: boolean): GlyphUV {
		const key = makeKey(char, bold, italic);
		const cached = this.cache.get(key);
		if (cached) return cached;

		const style = `${italic ? "italic " : ""}${bold ? "bold " : ""}`;
		this.ctx.font = `${style}${this.fontSize}px ${this.fontFamily}`;
		this.ctx.fillStyle = "white";
		this.ctx.textBaseline = "top";

		const w = this.cellWidth;
		const h = this.cellHeight;

		// Shelf packing: advance to next row if current glyph won't fit
		if (this.shelfX + w > this.atlasWidth) {
			this.shelfX = 0;
			this.shelfY += this.shelfHeight;
			this.shelfHeight = 0;
		}

		this.ctx.fillText(char, this.shelfX, this.shelfY);

		const uv: GlyphUV = { u: this.shelfX, v: this.shelfY, w, h };
		this.shelfX += w;
		this.shelfHeight = Math.max(this.shelfHeight, h);
		this.cache.set(key, uv);
		return uv;
	}

	getTexture(): OffscreenCanvas {
		return this.canvas;
	}
}
