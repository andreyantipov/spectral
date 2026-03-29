import { sva } from "@styled-system/css";

export const appShellTemplate = sva({
	slots: ["root", "content", "page", "omniboxOverlay"],
	base: {
		root: {
			display: "flex",
			flexDirection: "row",
			height: "100%",
			width: "100%",
			bg: "#111111",
			overflow: "hidden",
			position: "relative",
		},
		content: {
			display: "flex",
			flexDirection: "column",
			flex: 1,
			minWidth: 0,
			height: "100%",
			bg: "#111111",
			position: "relative",
			padding: "6px 6px 6px 0",
		},
		page: {
			display: "flex",
			flex: 1,
			overflow: "hidden",
			position: "relative",
			borderRadius: "10px",
			bg: "#1e1e1e",
		},
		omniboxOverlay: {
			position: "absolute",
			top: "20%",
			left: "50%",
			transform: "translateX(-50%)",
			width: "min(640px, 90%)",
			zIndex: 50,
		},
	},
});
