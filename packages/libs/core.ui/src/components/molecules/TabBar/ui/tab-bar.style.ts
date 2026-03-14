import { sva } from "../../../../../styled-system/css";

export const tabBar = sva({
	slots: ["root", "tab", "tabTitle", "closeButton", "newTabButton"],
	base: {
		root: {
			display: "flex",
			alignItems: "center",
			height: "36px",
			bg: "bg.primary",
			paddingLeft: "80px",
			paddingRight: "8px",
			gap: "2px",
			userSelect: "none",
			overflow: "hidden",
		},
		tab: {
			display: "flex",
			alignItems: "center",
			height: "28px",
			px: "12px",
			gap: "6px",
			borderRadius: "sm",
			fontSize: "12px",
			fontFamily: "body",
			color: "fg.secondary",
			cursor: "pointer",
			flexShrink: 0,
			maxWidth: "180px",
			transition: "all 0.1s ease",
			_hover: {
				bg: "bg.secondary",
				color: "fg.primary",
			},
		},
		tabTitle: {
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
			flex: 1,
		},
		closeButton: {
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			width: "16px",
			height: "16px",
			borderRadius: "sm",
			fontSize: "14px",
			lineHeight: 1,
			color: "fg.muted",
			cursor: "pointer",
			flexShrink: 0,
			_hover: {
				bg: "bg.primary",
				color: "fg.primary",
			},
		},
		newTabButton: {
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			width: "28px",
			height: "28px",
			borderRadius: "sm",
			fontSize: "18px",
			lineHeight: 1,
			color: "fg.muted",
			cursor: "pointer",
			flexShrink: 0,
			_hover: {
				bg: "bg.secondary",
				color: "fg.primary",
			},
		},
	},
	variants: {
		active: {
			true: {
				tab: {
					bg: "bg.tertiary",
					color: "fg.primary",
				},
			},
		},
	},
});
