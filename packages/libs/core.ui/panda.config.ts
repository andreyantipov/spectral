import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  preflight: true,
  jsxFramework: "solid",
  include: ["./src/**/*.{ts,tsx}"],
  exclude: [],
  outdir: "styled-system",

  theme: {
    extend: {
      tokens: {
        colors: {
          bg: {
            primary: { value: "#0a0a0a" },
            secondary: { value: "#141414" },
            tertiary: { value: "#1e1e1e" },
          },
          fg: {
            primary: { value: "#fafafa" },
            secondary: { value: "#a0a0a0" },
            muted: { value: "#666666" },
          },
          accent: {
            DEFAULT: { value: "#3b82f6" },
            hover: { value: "#2563eb" },
            active: { value: "#1d4ed8" },
          },
          border: {
            DEFAULT: { value: "#2a2a2a" },
            hover: { value: "#3a3a3a" },
          },
        },
        fonts: {
          body: { value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
          mono: { value: "'SF Mono', 'Fira Code', 'Fira Mono', Menlo, monospace" },
        },
        radii: {
          sm: { value: "4px" },
          md: { value: "8px" },
          lg: { value: "12px" },
        },
      },
    },
  },
});
