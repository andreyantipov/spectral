import { sva } from "#styled-system/css";

export const text = sva({
	slots: ["root"],
	base: {
		root: {
			fontFamily: "body",
			color: "fg.primary",
		},
	},
	variants: {
		variant: {
			heading: { root: { fontWeight: "bold", letterSpacing: "-0.02em" } },
			body: { root: { fontWeight: "normal" } },
			caption: { root: { color: "fg.muted", fontSize: "13px" } },
			mono: { root: { fontFamily: "mono", fontSize: "13px" } },
		},
		size: {
			xs: { root: { fontSize: "12px" } },
			sm: { root: { fontSize: "14px" } },
			md: { root: { fontSize: "16px" } },
			lg: { root: { fontSize: "20px" } },
			xl: { root: { fontSize: "24px" } },
			"2xl": { root: { fontSize: "32px" } },
		},
	},
	defaultVariants: {
		variant: "body",
		size: "md",
	},
});
