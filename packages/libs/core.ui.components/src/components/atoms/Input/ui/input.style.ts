import { sva } from "@styled-system/css";

export const input = sva({
	slots: ["root"],
	base: {
		root: {
			fontFamily: "body",
			fontSize: "14px",
			color: "fg.primary",
			bg: "bg.secondary",
			border: "1px solid",
			borderColor: "border",
			borderRadius: "md",
			outline: "none",
			width: "100%",
			transition: "all 0.15s ease",
			_placeholder: { color: "fg.muted" },
			_focus: { borderColor: "accent" },
			_disabled: { opacity: 0.5, cursor: "not-allowed" },
		},
	},
	variants: {
		size: {
			sm: { root: { height: "32px", px: "10px" } },
			md: { root: { height: "38px", px: "12px" } },
			lg: { root: { height: "44px", px: "14px" } },
		},
	},
	defaultVariants: {
		size: "md",
	},
});
