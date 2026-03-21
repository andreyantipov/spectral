import { sva } from "@styled-system/css";

export const tabGroupPills = sva({
	slots: ["container", "pill", "favicon", "title"],
	base: {
		container: {
			display: "flex",
			alignItems: "center",
			gap: "3px",
			padding: "4px",
			bg: "#2A2A2A",
			borderRadius: "8px",
			width: "100%",
			overflow: "hidden",
		},
		pill: {
			display: "flex",
			alignItems: "center",
			gap: "5px",
			px: "6px",
			py: "4px",
			height: "28px",
			borderRadius: "6px",
			cursor: "pointer",
			flexShrink: 0,
		},
		favicon: { width: "14px", height: "14px", borderRadius: "2px", flexShrink: 0 },
		title: {
			fontSize: "11px",
			fontFamily: "Inter, sans-serif",
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
		},
	},
	variants: {
		active: {
			true: {
				pill: { bg: "#3A3A3A" },
				title: { color: "#E8E0D4", fontWeight: "500" },
			},
			false: {
				pill: { bg: "transparent" },
				title: { color: "#8A8A8A" },
			},
		},
	},
	defaultVariants: { active: false },
});
