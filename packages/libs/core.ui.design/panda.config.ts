import { defineConfig } from "@pandacss/dev";

export default defineConfig({
	preflight: true,
	jsxFramework: "solid",
	include: ["./src/**/*.{ts,tsx}", "../core.ui.components/src/**/*.{ts,tsx}"],
	exclude: [],
	outdir: "styled-system",

	theme: {
		extend: {
			tokens: {
				colors: {
					bg: {
						primary: { value: "var(--color-bg-primary)" },
						secondary: { value: "var(--color-bg-secondary)" },
						tertiary: { value: "var(--color-bg-tertiary)" },
					},
					fg: {
						primary: { value: "var(--color-fg-primary)" },
						secondary: { value: "var(--color-fg-secondary)" },
						muted: { value: "var(--color-fg-muted)" },
						inverse: { value: "var(--color-fg-inverse)" },
					},
					accent: {
						DEFAULT: { value: "var(--color-accent)" },
						hover: { value: "var(--color-accent-hover)" },
						active: { value: "var(--color-accent-active)" },
					},
					border: {
						DEFAULT: { value: "var(--color-border)" },
						hover: { value: "var(--color-border-hover)" },
					},
				},
				fonts: {
					body: { value: "var(--font-body)" },
					mono: { value: "var(--font-mono)" },
				},
				radii: {
					sm: { value: "var(--radius-sm)" },
					md: { value: "var(--radius-md)" },
					lg: { value: "var(--radius-lg)" },
				},
			},
		},
	},
});
