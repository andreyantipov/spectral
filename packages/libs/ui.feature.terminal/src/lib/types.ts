export type Cell = {
	char: string;
	fg: [number, number, number]; // RGB 0-255
	bg: [number, number, number]; // RGB 0-255
	bold: boolean;
	italic: boolean;
	underline: boolean;
};

export type CellGrid = {
	cols: number;
	rows: number;
	cells: Cell[][];
};

export type CursorState = {
	row: number;
	col: number;
	visible: boolean;
};

export type GlyphUV = {
	u: number; // x in atlas (pixels)
	v: number; // y in atlas (pixels)
	w: number; // glyph width (pixels)
	h: number; // glyph height (pixels)
};
