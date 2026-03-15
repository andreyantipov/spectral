import { sva } from "../../../../../styled-system/css";

export const appShellTemplate = sva({
	slots: ["root", "content", "page"],
	base: {
		root: {
			display: "flex",
			flexDirection: "row",
			height: "100%",
			width: "100%",
			bg: "bg.primary",
			overflow: "hidden",
			position: "relative",
		},
		content: {
			display: "flex",
			flexDirection: "column",
			flex: 1,
			minWidth: 0,
			height: "100%",
			bg: "bg.primary",
		},
		page: {
			display: "flex",
			flex: 1,
			alignItems: "center",
			justifyContent: "center",
			overflow: "auto",
		},
	},
});
