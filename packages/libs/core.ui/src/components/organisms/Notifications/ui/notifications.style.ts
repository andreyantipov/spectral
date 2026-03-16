import { sva } from "../../../../../styled-system/css";

export const notifications = sva({
	slots: [
		"group",
		"toast",
		"toastTitle",
		"toastDescription",
		"toastCloseTrigger",
		"toastActionTrigger",
	],
	base: {
		group: {
			position: "fixed",
			zIndex: 200,
			display: "flex",
			flexDirection: "column",
			gap: "8px",
			padding: "16px",
			pointerEvents: "none",
			"&[data-placement^='top']": {
				top: 0,
			},
			"&[data-placement^='bottom']": {
				bottom: 0,
			},
			"&[data-placement$='start']": {
				left: 0,
			},
			"&[data-placement$='end']": {
				right: 0,
			},
			"&[data-placement='top'], &[data-placement='bottom']": {
				left: "50%",
				transform: "translateX(-50%)",
			},
		},
		toast: {
			display: "flex",
			alignItems: "flex-start",
			gap: "12px",
			minWidth: "300px",
			maxWidth: "420px",
			px: "16px",
			py: "12px",
			borderRadius: "lg",
			bg: "bg.secondary",
			boxShadow: "xl",
			pointerEvents: "auto",
			fontSize: "13px",
			fontFamily: "body",
			color: "fg.primary",
			borderWidth: "1px",
			borderColor: "bg.tertiary",
			"&[data-type='success']": {
				borderColor: "green.700",
			},
			"&[data-type='error']": {
				borderColor: "red.700",
			},
			"&[data-type='info']": {
				borderColor: "blue.700",
			},
		},
		toastTitle: {
			fontWeight: "600",
			fontSize: "13px",
		},
		toastDescription: {
			fontSize: "12px",
			color: "fg.secondary",
			mt: "2px",
		},
		toastCloseTrigger: {
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			width: "20px",
			height: "20px",
			borderRadius: "sm",
			cursor: "pointer",
			color: "fg.muted",
			flexShrink: 0,
			ml: "auto",
			_hover: {
				bg: "bg.tertiary",
				color: "fg.primary",
			},
		},
		toastActionTrigger: {
			fontSize: "12px",
			fontWeight: "600",
			color: "accent",
			cursor: "pointer",
			mt: "4px",
			_hover: {
				textDecoration: "underline",
			},
		},
	},
});
