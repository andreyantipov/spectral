import { sva } from "@styled-system/css";

export const contextMenu = sva({
	slots: ["root", "item", "icon", "label", "shortcut", "divider"],
	base: {
		root: {
			display: "flex",
			flexDirection: "column",
			minWidth: "200px",
			bg: "#2C2C2E",
			borderRadius: "8px",
			border: "1px solid #48484A",
			padding: "4px 0",
			boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
			zIndex: 100,
		},
		item: {
			display: "flex",
			alignItems: "center",
			height: "32px",
			px: "12px",
			gap: "10px",
			cursor: "pointer",
			color: "#FFFFFF",
			fontSize: "13px",
			fontFamily: "Inter, sans-serif",
			_hover: { bg: "#3A5BA0" },
		},
		icon: { width: "16px", height: "16px", color: "#8E8E93" },
		label: { flex: 1 },
		shortcut: { fontSize: "12px", color: "#666666" },
		divider: { height: "1px", bg: "#48484A", mx: "0" },
	},
});
