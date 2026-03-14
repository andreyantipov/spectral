import { sva } from "../../../../../styled-system/css";

export const addressBar = sva({
	slots: ["root", "navButton", "urlInput"],
	base: {
		root: {
			display: "flex",
			alignItems: "center",
			height: "36px",
			bg: "bg.primary",
			px: "8px",
			gap: "4px",
			userSelect: "none",
		},
		navButton: {
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			width: "28px",
			height: "28px",
			borderRadius: "sm",
			fontSize: "16px",
			lineHeight: 1,
			color: "fg.muted",
			cursor: "pointer",
			flexShrink: 0,
			border: "none",
			bg: "transparent",
			_hover: {
				bg: "bg.secondary",
				color: "fg.primary",
			},
		},
		urlInput: {
			flex: 1,
			height: "28px",
			px: "10px",
			bg: "bg.secondary",
			border: "1px solid",
			borderColor: "border",
			borderRadius: "md",
			color: "fg.primary",
			fontSize: "13px",
			fontFamily: "body",
			outline: "none",
			_focus: {
				borderColor: "accent",
			},
			_placeholder: {
				color: "fg.muted",
			},
		},
	},
});
