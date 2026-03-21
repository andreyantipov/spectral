import { sva } from "@styled-system/css";

export const blankPage = sva({
	slots: ["root", "icon", "label"],
	base: {
		root: {
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			justifyContent: "center",
			height: "100%",
			width: "100%",
			bg: "bg.canvas",
			gap: "16px",
			userSelect: "none",
		},
		icon: {
			width: "48px",
			height: "48px",
			opacity: 0.12,
			color: "fg.default",
		},
		label: {
			fontSize: "13px",
			fontWeight: 500,
			fontFamily: "body",
			color: "fg.default",
			opacity: 0.12,
			letterSpacing: "0.05em",
		},
	},
});
