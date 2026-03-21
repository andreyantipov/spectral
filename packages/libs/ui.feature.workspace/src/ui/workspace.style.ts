import { sva } from "@styled-system/css";

export const workspace = sva({
	slots: ["root", "pane", "sash"],
	base: {
		root: {
			display: "flex",
			flex: 1,
			height: "100%",
			overflow: "hidden",
		},
		pane: {
			borderRadius: "10px",
			overflow: "hidden",
			bg: "#1e1e1e",
		},
		sash: {
			bg: "transparent",
			cursor: "col-resize",
		},
	},
});
