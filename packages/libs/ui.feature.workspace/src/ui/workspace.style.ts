import { sva } from "@styled-system/css";

export const workspace = sva({
	slots: ["root", "split", "group", "tabBar", "tab", "tabClose", "viewport", "resizeHandle"],
	base: {
		root: {
			display: "flex",
			flex: 1,
			width: "100%",
			height: "100%",
			overflow: "hidden",
			bg: "#111111",
		},
		split: {
			display: "grid",
			width: "100%",
			height: "100%",
			overflow: "hidden",
		},
		group: {
			display: "flex",
			flexDirection: "column",
			width: "100%",
			height: "100%",
			overflow: "hidden",
			borderRadius: "10px",
			bg: "#1e1e1e",
		},
		tabBar: {
			display: "flex",
			alignItems: "center",
			height: "36px",
			px: "8px",
			gap: "2px",
			userSelect: "none",
			overflow: "hidden",
			bg: "#1a1a1a",
			borderTopRadius: "10px",
		},
		tab: {
			display: "flex",
			alignItems: "center",
			height: "28px",
			px: "10px",
			gap: "6px",
			borderRadius: "6px",
			fontSize: "12px",
			fontFamily: "Inter, sans-serif",
			color: "#8a8a8a",
			cursor: "pointer",
			flexShrink: 0,
			maxWidth: "180px",
			transition: "all 0.1s ease",
			_hover: {
				bg: "#2a2a2a",
				color: "#c0c0c0",
			},
		},
		tabClose: {
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			width: "16px",
			height: "16px",
			borderRadius: "4px",
			fontSize: "14px",
			lineHeight: 1,
			color: "#666",
			cursor: "pointer",
			flexShrink: 0,
			opacity: 0,
			transition: "opacity 0.1s ease",
			_hover: {
				bg: "#333",
				color: "#ccc",
			},
		},
		viewport: {
			flex: 1,
			overflow: "hidden",
			position: "relative",
		},
		resizeHandle: {
			bg: "transparent",
			transition: "background 0.15s ease",
			zIndex: 10,
			flexShrink: 0,
			_hover: {
				bg: "rgba(255,255,255,0.08)",
			},
		},
	},
	variants: {
		direction: {
			horizontal: {
				resizeHandle: {
					cursor: "col-resize",
					width: "6px",
					height: "100%",
				},
			},
			vertical: {
				resizeHandle: {
					cursor: "row-resize",
					width: "100%",
					height: "6px",
				},
			},
		},
		active: {
			true: {
				tab: {
					bg: "#2a2a2a",
					color: "#e8e0d4",
					fontWeight: "500",
				},
				tabClose: {
					opacity: 1,
				},
			},
		},
		focused: {
			true: {
				group: {
					outline: "1px solid rgba(59, 130, 246, 0.4)",
					outlineOffset: "-1px",
				},
			},
		},
		resizing: {
			true: {
				root: {
					userSelect: "none",
				},
			},
		},
	},
	defaultVariants: {
		active: false,
		focused: false,
		resizing: false,
	},
});
