import { sva } from "@styled-system/css";

export const button = sva({
	slots: ["root"],
	base: {
		root: {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			fontFamily: "body",
			fontWeight: "medium",
			cursor: "pointer",
			borderRadius: "md",
			transition: "all 0.15s ease",
			border: "1px solid transparent",
			outline: "none",
			_disabled: {
				opacity: 0.5,
				cursor: "not-allowed",
			},
		},
	},
	variants: {
		variant: {
			solid: {
				root: {
					bg: "accent",
					color: "fg.primary",
					_hover: { bg: "accent.hover" },
					_active: { bg: "accent.active" },
				},
			},
			outline: {
				root: {
					bg: "transparent",
					color: "fg.primary",
					borderColor: "border",
					_hover: { borderColor: "border.hover", bg: "bg.secondary" },
				},
			},
			ghost: {
				root: {
					bg: "transparent",
					color: "fg.secondary",
					_hover: { bg: "bg.secondary", color: "fg.primary" },
				},
			},
		},
		size: {
			sm: { root: { height: "32px", px: "12px", fontSize: "13px" } },
			md: { root: { height: "38px", px: "16px", fontSize: "14px" } },
			lg: { root: { height: "44px", px: "20px", fontSize: "15px" } },
		},
	},
	defaultVariants: {
		variant: "solid",
		size: "md",
	},
});
