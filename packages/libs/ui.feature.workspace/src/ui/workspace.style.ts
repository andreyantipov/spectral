import { sva } from "@styled-system/css";

export const workspace = sva({
	slots: ["root", "pane", "sash"],
	base: {
		root: {
			display: "flex",
			flex: 1,
			height: "100%",
			overflow: "hidden",
			bg: "#111111",
		},
		pane: {
			borderRadius: "10px",
			overflow: "hidden",
			bg: "#1e1e1e",
		},
		sash: {
			bg: "transparent",
			cursor: "col-resize",
			width: "2px",
			transition: "background 0.15s ease",
			_hover: { bg: "rgba(255,255,255,0.1)" },
		},
	},
});
