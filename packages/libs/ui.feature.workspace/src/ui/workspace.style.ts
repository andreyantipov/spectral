import { sva } from "@styled-system/css";

export const workspace = sva({
	slots: ["root", "pane", "sash", "dropTarget", "emptyPane"],
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
			width: "100%",
			height: "100%",
		},
		sash: {
			bg: "transparent",
			cursor: "col-resize",
			transition: "background 0.15s ease",
			_hover: { bg: "rgba(255,255,255,0.08)" },
		},
		dropTarget: {
			bg: "rgba(59, 130, 246, 0.15)",
			borderRadius: "10px",
			border: "2px dashed rgba(59, 130, 246, 0.4)",
		},
		emptyPane: {
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			width: "100%",
			height: "100%",
			bg: "#1e1e1e",
			borderRadius: "10px",
			color: "rgba(255,255,255,0.2)",
			fontSize: "14px",
			fontFamily: "Inter, sans-serif",
			cursor: "pointer",
			_hover: { color: "rgba(255,255,255,0.4)" },
		},
	},
});
