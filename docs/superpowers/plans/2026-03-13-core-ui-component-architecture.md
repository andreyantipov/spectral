# core.ui Component Architecture Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `packages/libs/core.ui` to use Atomic Design hierarchy, sva-only styling, Zag.js machines, design tokens with CSS custom properties, and GritQL enforcement.

**Architecture:** Components organized into atoms/molecules/organisms/templates with strict one-way import boundaries. Each component follows a `ui/` + optional `lib/` folder structure with required files (`.tsx`, `.style.ts`, `.design.pen`, `.stories.tsx`). Design tokens flow through CSS custom properties from `design-tokens.css` → `panda.config.ts` → `sva` recipes.

**Tech Stack:** SolidJS, Panda CSS (sva), Zag.js, Storybook (storybook-solidjs), GritQL, Bun, pencil.dev

**Spec:** `docs/superpowers/specs/2026-03-13-core-ui-component-architecture-design.md`

---

## Chunk 1: Foundation — Tokens, Path Alias, Dependencies

### Task 1: Create design token CSS files

**Files:**
- Create: `packages/libs/core.ui/src/tokens/design-tokens.css`
- Create: `packages/libs/core.ui/src/tokens/themes/dark.css`

- [ ] **Step 1: Create the tokens directory structure**

Note: `packages/libs/core.ui/src/tokens/` may already exist (currently empty). This is safe — `mkdir -p` is idempotent.

```bash
mkdir -p packages/libs/core.ui/src/tokens/themes
```

- [ ] **Step 2: Create design-tokens.css**

Create `packages/libs/core.ui/src/tokens/design-tokens.css`:

```css
:root {
  /* Background */
  --color-bg-primary: #0a0a0a;
  --color-bg-secondary: #141414;
  --color-bg-tertiary: #1e1e1e;

  /* Foreground */
  --color-fg-primary: #fafafa;
  --color-fg-secondary: #a0a0a0;
  --color-fg-muted: #666666;
  --color-fg-inverse: #0a0a0a;

  /* Accent */
  --color-accent: #3b82f6;
  --color-accent-hover: #2563eb;
  --color-accent-active: #1d4ed8;

  /* Border */
  --color-border: #2a2a2a;
  --color-border-hover: #3a3a3a;

  /* Typography */
  --font-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, monospace;

  /* Spacing (extend as needed) */
  /* Add spacing tokens here as the design system grows */

  /* Radii */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}
```

- [ ] **Step 3: Create dark.css theme (current defaults — placeholder for future theming)**

Create `packages/libs/core.ui/src/tokens/themes/dark.css`:

```css
/* Dark theme — currently the default. Values here override design-tokens.css.
   This file is a placeholder for when a light theme is added. */
```

- [ ] **Step 4: Wire design-tokens.css into the CSS pipeline**

The CSS custom properties must be loaded at runtime. Add an `@import` in panda's `globalCss` or ensure the token file is imported in the app entry point. The simplest approach: import it in the Storybook preview and in the desktop app's entry.

Check Storybook config location:
```bash
ls packages/libs/core.ui/.storybook/
```

Add to the Storybook preview (e.g., `.storybook/preview.ts` or `.storybook/preview.tsx`):
```ts
import "../src/tokens/design-tokens.css";
```

For the desktop app, add to `packages/apps/desktop/src/main-ui/mount.tsx`:
```ts
import "@ctrl/core.ui/src/tokens/design-tokens.css";
```

(The exact import path depends on how the monorepo resolves — may need a relative path or a package export.)

- [ ] **Step 5: Commit**

```bash
git add packages/libs/core.ui/src/tokens/ packages/libs/core.ui/.storybook/ packages/apps/desktop/src/main-ui/mount.tsx
git commit -m "feat(core.ui): add design token CSS custom properties"
```

---

### Task 2: Update panda.config.ts to consume CSS variables

**Files:**
- Modify: `packages/libs/core.ui/panda.config.ts`

- [ ] **Step 1: Update panda.config.ts**

Replace the entire theme section in `packages/libs/core.ui/panda.config.ts` to reference CSS variables instead of hardcoded hex values:

```ts
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
```

- [ ] **Step 2: Regenerate Panda CSS styled-system**

```bash
cd packages/libs/core.ui && bunx panda codegen
```

Expected: styled-system directory regenerated without errors.

- [ ] **Step 3: Verify the build still works**

```bash
cd /Users/me/Developer/ctrl.page && bun run build
```

Expected: No errors. Components still render correctly (token values are the same, just referenced via CSS vars now).

- [ ] **Step 4: Commit**

```bash
git add packages/libs/core.ui/panda.config.ts packages/libs/core.ui/styled-system/
git commit -m "feat(core.ui): migrate panda tokens to CSS custom properties"
```

---

### Task 3: Add tsconfig path alias for styled-system

**Files:**
- Modify: `packages/libs/core.ui/tsconfig.json`

- [ ] **Step 1: Add path alias**

Update `packages/libs/core.ui/tsconfig.json`:

```json
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "solid-js",
    "outDir": "dist",
    "rootDir": "src",
    "paths": {
      "#styled-system/*": ["./styled-system/*"]
    }
  },
  "include": ["src", "styled-system"]
}
```

Note: Using `#styled-system` (with `#` prefix) as it's Node's subpath imports convention and won't conflict with npm packages.

- [ ] **Step 2: Add `imports` field to core.ui's package.json**

The tsconfig `paths` only satisfies the TypeScript type checker. Bun's runtime module resolver requires `#` imports to be declared in `package.json`'s `imports` field.

Read `packages/libs/core.ui/package.json` and add:

```json
"imports": {
  "#styled-system/*": "./styled-system/*"
}
```

- [ ] **Step 3: Verify the alias resolves**

```bash
cd packages/libs/core.ui && bunx panda codegen
```

Expected: Panda regenerates styled-system without errors. If `panda codegen` has trouble resolving `#styled-system` in source files, fall back to relative imports (`../../../../styled-system/css`) and remove the alias. The alias is a nice-to-have, not a blocker.

- [ ] **Step 4: Commit**

```bash
git add packages/libs/core.ui/tsconfig.json packages/libs/core.ui/package.json
git commit -m "feat(core.ui): add #styled-system path alias for styled-system imports"
```

---

### Task 4: Install Zag.js dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install @zag-js/solid**

```bash
cd /Users/me/Developer/ctrl.page && bun add @zag-js/solid
```

- [ ] **Step 2: Verify installation**

```bash
bun run check
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "feat: add @zag-js/solid dependency"
```

---

### Task 5: Create atomic directory structure

**Files:**
- Create: `packages/libs/core.ui/src/components/atoms/.gitkeep`
- Create: `packages/libs/core.ui/src/components/molecules/.gitkeep`
- Create: `packages/libs/core.ui/src/components/organisms/.gitkeep`
- Create: `packages/libs/core.ui/src/components/templates/.gitkeep`

- [ ] **Step 1: Create the directory structure**

```bash
mkdir -p packages/libs/core.ui/src/components/{atoms,molecules,organisms,templates}
touch packages/libs/core.ui/src/components/{atoms,molecules,organisms,templates}/.gitkeep
```

- [ ] **Step 2: Commit**

```bash
git add packages/libs/core.ui/src/components/{atoms,molecules,organisms,templates}/.gitkeep
git commit -m "feat(core.ui): create atomic design directory structure"
```

---

## Chunk 2: Migrate Atoms (Button, Text, Input)

### Task 6: Migrate Button to atoms/Button

**Files:**
- Create: `packages/libs/core.ui/src/components/atoms/Button/ui/button.style.ts`
- Create: `packages/libs/core.ui/src/components/atoms/Button/ui/Button.tsx`
- Create: `packages/libs/core.ui/src/components/atoms/Button/ui/Button.stories.tsx`
- Create: `packages/libs/core.ui/src/components/atoms/Button/index.ts`
- Delete: `packages/libs/core.ui/src/components/Button/Button.tsx`
- Delete: `packages/libs/core.ui/src/components/Button/Button.stories.tsx`

- [ ] **Step 1: Create the atoms/Button directory**

```bash
mkdir -p packages/libs/core.ui/src/components/atoms/Button/ui
```

- [ ] **Step 2: Create button.style.ts — convert cva to sva**

Create `packages/libs/core.ui/src/components/atoms/Button/ui/button.style.ts`:

```ts
import { sva } from "#styled-system/css";

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
```

- [ ] **Step 3: Create Button.tsx — use $ convention**

Create `packages/libs/core.ui/src/components/atoms/Button/ui/Button.tsx`:

```tsx
import { type JSX, splitProps } from "solid-js";
import { button } from "./button.style";

export type ButtonProps = {
	variant?: "solid" | "outline" | "ghost";
	size?: "sm" | "md" | "lg";
	class?: string;
} & JSX.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button(props: ButtonProps) {
	const [variants, rest] = splitProps(props, ["variant", "size", "class"]);
	const $ = button({ variant: variants.variant, size: variants.size });
	return <button class={`${$.root} ${variants.class ?? ""}`} {...rest} />;
}
```

- [ ] **Step 4: Create Button.stories.tsx — update import path and story title**

Create `packages/libs/core.ui/src/components/atoms/Button/ui/Button.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "storybook-solidjs";
import { Button } from "./Button";

const meta = {
	title: "Atoms/Button",
	component: Button,
	argTypes: {
		variant: {
			control: "select",
			options: ["solid", "outline", "ghost"],
		},
		size: {
			control: "select",
			options: ["sm", "md", "lg"],
		},
	},
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Solid: Story = {
	args: { variant: "solid", size: "md", children: "Button" },
};

export const Outline: Story = {
	args: { variant: "outline", size: "md", children: "Button" },
};

export const Ghost: Story = {
	args: { variant: "ghost", size: "md", children: "Button" },
};

export const Small: Story = {
	args: { variant: "solid", size: "sm", children: "Small" },
};

export const Large: Story = {
	args: { variant: "solid", size: "lg", children: "Large" },
};

export const Disabled: Story = {
	args: { variant: "solid", children: "Disabled", disabled: true },
};
```

- [ ] **Step 5: Create index.ts — encapsulation export**

Create `packages/libs/core.ui/src/components/atoms/Button/index.ts`:

```ts
export { Button } from "./ui/Button";
export type { ButtonProps } from "./ui/Button";
```

- [ ] **Step 6: Create placeholder button.design.pen**

Use pencil.dev to generate the Button design file. For now, create a minimal placeholder:

```bash
echo '{"version":"2.8","children":[]}' > packages/libs/core.ui/src/components/atoms/Button/ui/button.design.pen
```

Note: Replace with actual pencil.dev-generated design file as soon as possible.

- [ ] **Step 7: Delete old Button files**

```bash
rm packages/libs/core.ui/src/components/Button/Button.tsx
rm packages/libs/core.ui/src/components/Button/Button.stories.tsx
rmdir packages/libs/core.ui/src/components/Button
```

- [ ] **Step 8: Update barrel export for Button**

In `packages/libs/core.ui/src/index.ts`, change the Button export:

```ts
// Change this:
export { Button } from "./components/Button/Button";
// To this:
export { Button } from "./components/atoms/Button";
export type { ButtonProps } from "./components/atoms/Button";
```

- [ ] **Step 9: Verify build**

```bash
cd /Users/me/Developer/ctrl.page && bun run build
```

Expected: Build succeeds.

- [ ] **Step 10: Commit**

```bash
git add packages/libs/core.ui/src/components/atoms/Button/ packages/libs/core.ui/src/index.ts
git rm packages/libs/core.ui/src/components/Button/Button.tsx packages/libs/core.ui/src/components/Button/Button.stories.tsx
git commit -m "feat(core.ui): migrate Button to atoms/Button with sva"
```

---

### Task 7: Migrate Text to atoms/Text

**Files:**
- Create: `packages/libs/core.ui/src/components/atoms/Text/ui/text.style.ts`
- Create: `packages/libs/core.ui/src/components/atoms/Text/ui/Text.tsx`
- Create: `packages/libs/core.ui/src/components/atoms/Text/ui/Text.stories.tsx`
- Create: `packages/libs/core.ui/src/components/atoms/Text/ui/text.design.pen`
- Create: `packages/libs/core.ui/src/components/atoms/Text/index.ts`
- Delete: `packages/libs/core.ui/src/components/Text/Text.tsx`
- Delete: `packages/libs/core.ui/src/components/Text/Text.stories.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p packages/libs/core.ui/src/components/atoms/Text/ui
```

- [ ] **Step 2: Create text.style.ts — convert cva to sva**

Create `packages/libs/core.ui/src/components/atoms/Text/ui/text.style.ts`:

```ts
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
```

- [ ] **Step 3: Create Text.tsx**

Create `packages/libs/core.ui/src/components/atoms/Text/ui/Text.tsx`:

```tsx
import { type ParentProps, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";
import { text } from "./text.style";

export type TextProps = ParentProps<{
	variant?: "heading" | "body" | "caption" | "mono";
	size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
	as?: "span" | "p" | "h1" | "h2" | "h3" | "h4" | "label";
	class?: string;
}>;

export function Text(props: TextProps) {
	const [local, variants] = splitProps(props, ["as", "children", "class"], ["variant", "size"]);
	const $ = text({ variant: variants.variant, size: variants.size });
	return (
		<Dynamic component={local.as ?? "span"} class={`${$.root} ${local.class ?? ""}`}>
			{local.children}
		</Dynamic>
	);
}
```

- [ ] **Step 4: Create Text.stories.tsx**

Create `packages/libs/core.ui/src/components/atoms/Text/ui/Text.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "storybook-solidjs";
import { Text } from "./Text";

const meta = {
	title: "Atoms/Text",
	component: Text,
	argTypes: {
		variant: {
			control: "select",
			options: ["heading", "body", "caption", "mono"],
		},
		size: {
			control: "select",
			options: ["xs", "sm", "md", "lg", "xl", "2xl"],
		},
		as: {
			control: "select",
			options: ["span", "p", "h1", "h2", "h3", "h4", "label"],
		},
	},
} satisfies Meta<typeof Text>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Body: Story = {
	args: { variant: "body", children: "Body text" },
};

export const Heading: Story = {
	args: { variant: "heading", size: "xl", as: "h1", children: "Heading" },
};

export const Caption: Story = {
	args: { variant: "caption", children: "Caption text" },
};

export const Mono: Story = {
	args: { variant: "mono", children: "monospace text" },
};
```

- [ ] **Step 5: Create index.ts and placeholder .design.pen**

Create `packages/libs/core.ui/src/components/atoms/Text/index.ts`:

```ts
export { Text } from "./ui/Text";
export type { TextProps } from "./ui/Text";
```

```bash
echo '{"version":"2.8","children":[]}' > packages/libs/core.ui/src/components/atoms/Text/ui/text.design.pen
```

- [ ] **Step 6: Update barrel export for Text**

In `packages/libs/core.ui/src/index.ts`, change the Text export:

```ts
// Change this:
export { Text } from "./components/Text/Text";
// To this:
export { Text } from "./components/atoms/Text";
export type { TextProps } from "./components/atoms/Text";
```

- [ ] **Step 7: Delete old Text files and commit**

```bash
git rm packages/libs/core.ui/src/components/Text/Text.tsx packages/libs/core.ui/src/components/Text/Text.stories.tsx
git add packages/libs/core.ui/src/components/atoms/Text/ packages/libs/core.ui/src/index.ts
git commit -m "feat(core.ui): migrate Text to atoms/Text with sva"
```

---

### Task 8: Migrate Input to atoms/Input

**Files:**
- Create: `packages/libs/core.ui/src/components/atoms/Input/ui/input.style.ts`
- Create: `packages/libs/core.ui/src/components/atoms/Input/ui/Input.tsx`
- Create: `packages/libs/core.ui/src/components/atoms/Input/ui/Input.stories.tsx`
- Create: `packages/libs/core.ui/src/components/atoms/Input/ui/input.design.pen`
- Create: `packages/libs/core.ui/src/components/atoms/Input/index.ts`
- Delete: `packages/libs/core.ui/src/components/Input/Input.tsx`
- Delete: `packages/libs/core.ui/src/components/Input/Input.stories.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p packages/libs/core.ui/src/components/atoms/Input/ui
```

- [ ] **Step 2: Create input.style.ts — convert cva to sva**

Create `packages/libs/core.ui/src/components/atoms/Input/ui/input.style.ts`:

```ts
import { sva } from "#styled-system/css";

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
```

- [ ] **Step 3: Create Input.tsx**

Create `packages/libs/core.ui/src/components/atoms/Input/ui/Input.tsx`:

```tsx
import { type JSX, splitProps } from "solid-js";
import { input } from "./input.style";

export type InputProps = {
	size?: "sm" | "md" | "lg";
	class?: string;
} & JSX.InputHTMLAttributes<HTMLInputElement>;

export function Input(props: InputProps) {
	const [variants, rest] = splitProps(props, ["size", "class"]);
	const $ = input({ size: variants.size });
	return <input class={`${$.root} ${variants.class ?? ""}`} {...rest} />;
}
```

- [ ] **Step 4: Create Input.stories.tsx**

Create `packages/libs/core.ui/src/components/atoms/Input/ui/Input.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "storybook-solidjs";
import { Input } from "./Input";

const meta = {
	title: "Atoms/Input",
	component: Input,
	argTypes: {
		size: {
			control: "select",
			options: ["sm", "md", "lg"],
		},
	},
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: { placeholder: "Enter text..." },
};

export const Small: Story = {
	args: { size: "sm", placeholder: "Small input" },
};

export const Large: Story = {
	args: { size: "lg", placeholder: "Large input" },
};

export const Disabled: Story = {
	args: { placeholder: "Disabled", disabled: true },
};
```

- [ ] **Step 5: Create index.ts and placeholder .design.pen**

Create `packages/libs/core.ui/src/components/atoms/Input/index.ts`:

```ts
export { Input } from "./ui/Input";
export type { InputProps } from "./ui/Input";
```

```bash
echo '{"version":"2.8","children":[]}' > packages/libs/core.ui/src/components/atoms/Input/ui/input.design.pen
```

- [ ] **Step 6: Update barrel export for Input**

In `packages/libs/core.ui/src/index.ts`, change the Input export:

```ts
// Change this:
export { Input } from "./components/Input/Input";
// To this:
export { Input } from "./components/atoms/Input";
export type { InputProps } from "./components/atoms/Input";
```

- [ ] **Step 7: Delete old Input files and commit**

```bash
git rm packages/libs/core.ui/src/components/Input/Input.tsx packages/libs/core.ui/src/components/Input/Input.stories.tsx
git add packages/libs/core.ui/src/components/atoms/Input/ packages/libs/core.ui/src/index.ts
git commit -m "feat(core.ui): migrate Input to atoms/Input with sva"
```

---

## Chunk 3: Migrate Molecules (TabBar, AddressBar)

### Task 9: Migrate TabBar to molecules/TabBar

**Files:**
- Create: `packages/libs/core.ui/src/components/molecules/TabBar/ui/tab-bar.style.ts`
- Create: `packages/libs/core.ui/src/components/molecules/TabBar/ui/TabBar.tsx`
- Create: `packages/libs/core.ui/src/components/molecules/TabBar/ui/TabBar.stories.tsx` (note: no existing stories — create new)
- Create: `packages/libs/core.ui/src/components/molecules/TabBar/ui/tab-bar.design.pen`
- Create: `packages/libs/core.ui/src/components/molecules/TabBar/index.ts`
- Delete: `packages/libs/core.ui/src/components/TabBar/TabBar.tsx`
- Delete: `packages/libs/core.ui/src/components/TabBar/TabBar.style.ts`

- [ ] **Step 1: Create directory**

```bash
mkdir -p packages/libs/core.ui/src/components/molecules/TabBar/ui
```

- [ ] **Step 2: Move and update tab-bar.style.ts — rename file to kebab-case, update import**

Create `packages/libs/core.ui/src/components/molecules/TabBar/ui/tab-bar.style.ts`:

Copy the existing `TabBar.style.ts` content but update the import path:

```ts
import { sva } from "#styled-system/css";

export const tabBar = sva({
	// ... exact same content as current TabBar.style.ts slots/base/variants
	// (already uses sva — just update the import path)
});
```

Copy the existing file and update the import:

```bash
cp packages/libs/core.ui/src/components/TabBar/TabBar.style.ts packages/libs/core.ui/src/components/molecules/TabBar/ui/tab-bar.style.ts
```

Then update the import in the new file:

```ts
// Change this:
import { sva } from "../../../styled-system/css";
// To this:
import { sva } from "#styled-system/css";
```

- [ ] **Step 3: Create TabBar.tsx — update style import and use $ convention**

Create `packages/libs/core.ui/src/components/molecules/TabBar/ui/TabBar.tsx`:

```tsx
import { For, Show } from "solid-js";
import { tabBar } from "./tab-bar.style";

export type TabData = {
	id: number;
	url: string;
	title: string;
	isActive: number;
};

export type TabBarProps = {
	tabs: TabData[];
	activeTabId: number | null;
	onTabClick: (id: number) => void;
	onTabClose: (id: number) => void;
	onNewTab: () => void;
};

function hostnameFromUrl(url: string): string {
	try {
		const u = new URL(url);
		return u.hostname || url;
	} catch {
		return url || "New Tab";
	}
}

export function TabBar(props: TabBarProps) {
	const $ = tabBar();
	const $active = tabBar({ active: true });

	return (
		<div class={$.root}>
			<For each={props.tabs}>
				{(t) => {
					const s = () => (t.id === props.activeTabId ? $active : $);
					return (
						<button type="button" class={s().tab} onClick={() => props.onTabClick(t.id)}>
							<span class={s().tabTitle}>
								{t.title !== "New Tab" ? t.title : hostnameFromUrl(t.url)}
							</span>
							<Show when={props.tabs.length > 1}>
								<button
									type="button"
									class={s().closeButton}
									onClick={(e) => {
										e.stopPropagation();
										props.onTabClose(t.id);
									}}
								>
									&times;
								</button>
							</Show>
						</button>
					);
				}}
			</For>
			<button type="button" class={$.newTabButton} onClick={() => props.onNewTab()}>
				+
			</button>
		</div>
	);
}
```

- [ ] **Step 4: Create TabBar.stories.tsx**

Create `packages/libs/core.ui/src/components/molecules/TabBar/ui/TabBar.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "storybook-solidjs";
import { TabBar } from "./TabBar";

const sampleTabs = [
	{ id: 1, url: "https://example.com", title: "Example", isActive: 1 },
	{ id: 2, url: "https://solidjs.com", title: "SolidJS", isActive: 0 },
	{ id: 3, url: "about:blank", title: "New Tab", isActive: 0 },
];

const meta = {
	title: "Molecules/TabBar",
	component: TabBar,
} satisfies Meta<typeof TabBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		tabs: sampleTabs,
		activeTabId: 1,
	},
};

export const SingleTab: Story = {
	args: {
		tabs: [sampleTabs[0]],
		activeTabId: 1,
	},
};
```

- [ ] **Step 5: Create index.ts and placeholder .design.pen**

Create `packages/libs/core.ui/src/components/molecules/TabBar/index.ts`:

```ts
export { TabBar } from "./ui/TabBar";
export type { TabBarProps, TabData } from "./ui/TabBar";
```

```bash
echo '{"version":"2.8","children":[]}' > packages/libs/core.ui/src/components/molecules/TabBar/ui/tab-bar.design.pen
```

- [ ] **Step 6: Update barrel export for TabBar**

TabBar was not previously exported from `core.ui/src/index.ts`. Add it now (this is a **new** public API addition):

```ts
// Add to packages/libs/core.ui/src/index.ts:
export { TabBar } from "./components/molecules/TabBar";
export type { TabBarProps, TabData } from "./components/molecules/TabBar";
```

- [ ] **Step 7: Delete old TabBar files and commit**

```bash
git rm packages/libs/core.ui/src/components/TabBar/TabBar.tsx packages/libs/core.ui/src/components/TabBar/TabBar.style.ts
git add packages/libs/core.ui/src/components/molecules/TabBar/ packages/libs/core.ui/src/index.ts
git commit -m "feat(core.ui): migrate TabBar to molecules/TabBar"
```

---

### Task 10: Migrate AddressBar to molecules/AddressBar

**Files:**
- Create: `packages/libs/core.ui/src/components/molecules/AddressBar/ui/address-bar.style.ts`
- Create: `packages/libs/core.ui/src/components/molecules/AddressBar/ui/AddressBar.tsx`
- Create: `packages/libs/core.ui/src/components/molecules/AddressBar/ui/AddressBar.stories.tsx`
- Create: `packages/libs/core.ui/src/components/molecules/AddressBar/ui/address-bar.design.pen`
- Create: `packages/libs/core.ui/src/components/molecules/AddressBar/index.ts`
- Delete: `packages/libs/core.ui/src/components/AddressBar/AddressBar.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p packages/libs/core.ui/src/components/molecules/AddressBar/ui
```

- [ ] **Step 2: Create address-bar.style.ts — consolidate all cva/css into single sva**

Create `packages/libs/core.ui/src/components/molecules/AddressBar/ui/address-bar.style.ts`:

```ts
import { sva } from "#styled-system/css";

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
```

- [ ] **Step 3: Create AddressBar.tsx — use $ convention, remove inline cva/css**

Create `packages/libs/core.ui/src/components/molecules/AddressBar/ui/AddressBar.tsx`:

```tsx
import { createEffect, createSignal } from "solid-js";
import { addressBar } from "./address-bar.style";

export type AddressBarProps = {
	url: string;
	onNavigate: (url: string) => void;
	onBack: () => void;
	onForward: () => void;
};

function normalizeUrl(input: string): string {
	const trimmed = input.trim();
	if (!trimmed) return trimmed;
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(trimmed)) return `https://${trimmed}`;
	return trimmed;
}

export function AddressBar(props: AddressBarProps) {
	const $ = addressBar();
	const [inputValue, setInputValue] = createSignal(props.url);

	createEffect(() => {
		setInputValue(props.url);
	});

	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Enter") {
			const normalized = normalizeUrl(inputValue());
			if (normalized) {
				props.onNavigate(normalized);
			}
		}
	};

	const handleFocus = (e: FocusEvent) => {
		(e.target as HTMLInputElement).select();
	};

	return (
		<div class={$.root}>
			<button type="button" class={$.navButton} onClick={() => props.onBack()}>
				&#8592;
			</button>
			<button type="button" class={$.navButton} onClick={() => props.onForward()}>
				&#8594;
			</button>
			<input
				class={$.urlInput}
				type="text"
				value={inputValue()}
				onInput={(e) => setInputValue(e.currentTarget.value)}
				onKeyDown={handleKeyDown}
				onFocus={handleFocus}
				placeholder="Enter URL..."
				spellcheck={false}
			/>
		</div>
	);
}
```

- [ ] **Step 4: Create AddressBar.stories.tsx**

Create `packages/libs/core.ui/src/components/molecules/AddressBar/ui/AddressBar.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "storybook-solidjs";
import { AddressBar } from "./AddressBar";

const meta = {
	title: "Molecules/AddressBar",
	component: AddressBar,
} satisfies Meta<typeof AddressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		url: "https://example.com",
	},
};

export const Empty: Story = {
	args: {
		url: "",
	},
};
```

- [ ] **Step 5: Create index.ts and placeholder .design.pen**

Create `packages/libs/core.ui/src/components/molecules/AddressBar/index.ts`:

```ts
export { AddressBar } from "./ui/AddressBar";
export type { AddressBarProps } from "./ui/AddressBar";
```

```bash
echo '{"version":"2.8","children":[]}' > packages/libs/core.ui/src/components/molecules/AddressBar/ui/address-bar.design.pen
```

- [ ] **Step 6: Update barrel export for AddressBar**

In `packages/libs/core.ui/src/index.ts`, change the AddressBar export:

```ts
// Change this:
export { AddressBar } from "./components/AddressBar/AddressBar";
// To this:
export { AddressBar } from "./components/molecules/AddressBar";
export type { AddressBarProps } from "./components/molecules/AddressBar";
```

- [ ] **Step 7: Delete old AddressBar files and commit**

```bash
git rm packages/libs/core.ui/src/components/AddressBar/AddressBar.tsx
git add packages/libs/core.ui/src/components/molecules/AddressBar/ packages/libs/core.ui/src/index.ts
git commit -m "feat(core.ui): migrate AddressBar to molecules/AddressBar with sva"
```

---

## Chunk 4: Migrate Organisms (Sidebar)

### Task 11: Migrate Sidebar to organisms/Sidebar

**Files:**
- Create: `packages/libs/core.ui/src/components/organisms/Sidebar/ui/sidebar.style.ts`
- Create: `packages/libs/core.ui/src/components/organisms/Sidebar/ui/Sidebar.tsx`
- Create: `packages/libs/core.ui/src/components/organisms/Sidebar/ui/Sidebar.stories.tsx`
- Move: `packages/libs/core.ui/src/components/Sidebar/Sidebar.design.pen` → `packages/libs/core.ui/src/components/organisms/Sidebar/ui/sidebar.design.pen`
- Create: `packages/libs/core.ui/src/components/organisms/Sidebar/index.ts`
- Delete: `packages/libs/core.ui/src/components/Sidebar/`

- [ ] **Step 1: Create directory**

```bash
mkdir -p packages/libs/core.ui/src/components/organisms/Sidebar/ui
```

- [ ] **Step 2: Create sidebar.style.ts — update import path only**

Create `packages/libs/core.ui/src/components/organisms/Sidebar/ui/sidebar.style.ts`:

Copy the existing `packages/libs/core.ui/src/components/Sidebar/Sidebar.style.ts` file, changing only the import path on line 1:

```bash
cp packages/libs/core.ui/src/components/Sidebar/Sidebar.style.ts packages/libs/core.ui/src/components/organisms/Sidebar/ui/sidebar.style.ts
```

Then update the import in the new file:

```ts
// Change this:
import { sva } from "../../../styled-system/css";
// To this:
import { sva } from "#styled-system/css";
```

- [ ] **Step 3: Create Sidebar.tsx — update import, use $ convention**

Create `packages/libs/core.ui/src/components/organisms/Sidebar/ui/Sidebar.tsx`:

Same as existing `Sidebar.tsx` with these changes:
- Import from `"./sidebar.style"` instead of `"./Sidebar.style"`
- Rename `styles()` → `$()`, `activeTabStyles()` → `$activeTab()`, `activeItemStyles()` → `$activeItem()`

```tsx
import { createEffect, createSignal, For, type JSX, Show } from "solid-js";
import { sidebar } from "./sidebar.style";

export type SidebarTab = {
	id: string;
	icon: JSX.Element;
	label: string;
	badge?: number;
};

export type SidebarItem = {
	id: string;
	icon?: JSX.Element;
	label: string;
	indent?: number;
};

export type SidebarProps = {
	tabs: SidebarTab[];
	activeTabId?: string | null;
	items?: SidebarItem[];
	activeItemId?: string | null;
	position?: "left" | "right";
	float?: boolean;
	defaultWidth?: number;
	minWidth?: number;
	maxWidth?: number;
	collapsed?: boolean;
	onTabClick?: (id: string) => void;
	onItemClick?: (id: string) => void;
	onItemClose?: (id: string) => void;
	onNewTab?: () => void;
	onWidthChange?: (width: number) => void;
	onCollapseChange?: (collapsed: boolean) => void;
	children?: JSX.Element;
};

export function Sidebar(props: SidebarProps) {
	const minW = () => props.minWidth ?? 180;
	const maxW = () => props.maxWidth ?? 400;
	const [width, setWidth] = createSignal(props.defaultWidth ?? 240);
	const [dragging, setDragging] = createSignal(false);
	const collapsed = () => props.collapsed ?? false;
	const float = () => props.float ?? false;
	const position = () => props.position ?? "left";

	const $ = () => sidebar({ position: position(), float: float() });
	const $activeTab = () => sidebar({ position: position(), float: float(), activeTab: true });
	const $activeItem = () => sidebar({ position: position(), float: float(), activeItem: true });

	function onPointerDown(e: PointerEvent) {
		e.preventDefault();
		setDragging(true);
		const startX = e.clientX;
		const startW = width();

		function onPointerMove(e: PointerEvent) {
			const delta = position() === "left" ? e.clientX - startX : startX - e.clientX;
			const next = Math.max(minW(), Math.min(maxW(), startW + delta));
			setWidth(next);
			props.onWidthChange?.(next);
		}

		function onPointerUp() {
			setDragging(false);
			document.removeEventListener("pointermove", onPointerMove);
			document.removeEventListener("pointerup", onPointerUp);
		}

		document.addEventListener("pointermove", onPointerMove);
		document.addEventListener("pointerup", onPointerUp);
	}

	createEffect(() => {
		if (props.defaultWidth !== undefined) {
			setWidth(props.defaultWidth);
		}
	});

	return (
		<div
			class={$().root}
			style={{
				width: collapsed() ? undefined : `${width()}px`,
			}}
		>
			<div class={$().rail}>
				<div class={$().railTabs}>
					<For each={props.tabs}>
						{(tab) => {
							const s = () => (tab.id === props.activeTabId ? $activeTab() : $());
							return (
								<button
									type="button"
									class={s().railTab}
									onClick={() => {
										if (tab.id === props.activeTabId && !collapsed()) {
											props.onCollapseChange?.(true);
										} else {
											props.onCollapseChange?.(false);
											props.onTabClick?.(tab.id);
										}
									}}
									title={tab.label}
								>
									<span class={s().railTabIcon}>{tab.icon}</span>
									<Show when={tab.badge}>
										<span class={s().railTabBadge}>{tab.badge}</span>
									</Show>
								</button>
							);
						}}
					</For>
				</div>
			</div>

			<Show when={!collapsed()}>
				<div class={$().panel}>
					<div class={$().panelHeader}>
						<span class={$().panelTitle}>
							{props.tabs.find((t) => t.id === props.activeTabId)?.label ?? ""}
						</span>
						<Show when={props.onNewTab}>
							<button
								type="button"
								class={$().panelAction}
								onClick={() => props.onNewTab?.()}
								title="New tab"
							>
								+
							</button>
						</Show>
					</div>

					<div class={$().panelContent}>
						<Show when={props.items}>
							<For each={props.items}>
								{(item) => {
									const s = () => (item.id === props.activeItemId ? $activeItem() : $());
									return (
										<button
											type="button"
											class={s().panelItem}
											style={{
												"padding-left": `${8 + (item.indent ?? 0) * 12}px`,
											}}
											onClick={() => props.onItemClick?.(item.id)}
										>
											<Show when={item.icon}>
												<span class={s().panelItemIcon}>{item.icon}</span>
											</Show>
											<span class={s().panelItemLabel}>{item.label}</span>
											<Show when={props.onItemClose}>
												<button
													type="button"
													class={`${s().panelItemClose} panelItemClose`}
													onClick={(e) => {
														e.stopPropagation();
														props.onItemClose?.(item.id);
													}}
												>
													&times;
												</button>
											</Show>
										</button>
									);
								}}
							</For>
						</Show>
						{props.children}
					</div>
				</div>

				<div
					class={$().resizeHandle}
					data-dragging={dragging() || undefined}
					onPointerDown={onPointerDown}
				/>
			</Show>
		</div>
	);
}
```

- [ ] **Step 4: Create Sidebar.stories.tsx — copy and update**

```bash
cp packages/libs/core.ui/src/components/Sidebar/Sidebar.stories.tsx packages/libs/core.ui/src/components/organisms/Sidebar/ui/Sidebar.stories.tsx
```

Then update two lines in the new file:

```ts
// Change this:
import { Sidebar } from "./Sidebar";
// To this (no change needed — same relative import):
import { Sidebar } from "./Sidebar";

// Change the title:
// From: title: "Components/Sidebar",
// To:   title: "Organisms/Sidebar",
```

- [ ] **Step 5: Move .design.pen, create index.ts**

```bash
cp packages/libs/core.ui/src/components/Sidebar/Sidebar.design.pen packages/libs/core.ui/src/components/organisms/Sidebar/ui/sidebar.design.pen
```

Create `packages/libs/core.ui/src/components/organisms/Sidebar/index.ts`:

```ts
export { Sidebar } from "./ui/Sidebar";
export type { SidebarProps, SidebarItem, SidebarTab } from "./ui/Sidebar";
```

- [ ] **Step 6: Update barrel export for Sidebar**

In `packages/libs/core.ui/src/index.ts`, change the Sidebar export:

```ts
// Change this:
export {
	Sidebar,
	type SidebarItem,
	type SidebarProps,
	type SidebarTab,
} from "./components/Sidebar/Sidebar";
// To this:
export {
	Sidebar,
	type SidebarItem,
	type SidebarProps,
	type SidebarTab,
} from "./components/organisms/Sidebar";
```

- [ ] **Step 7: Delete old Sidebar files and commit**

```bash
git rm -r packages/libs/core.ui/src/components/Sidebar/
git add packages/libs/core.ui/src/components/organisms/Sidebar/ packages/libs/core.ui/src/index.ts
git commit -m "feat(core.ui): migrate Sidebar to organisms/Sidebar"
```

---

## Chunk 5: Update Barrel, GritQL Rules, Documentation

### Task 12: Verify barrel is complete

The barrel has been updated incrementally during each migration task. Verify the final state.

- [ ] **Step 1: Verify `packages/libs/core.ui/src/index.ts` has all exports**

Expected final content:

```ts
export { AddressBar } from "./components/molecules/AddressBar";
export type { AddressBarProps } from "./components/molecules/AddressBar";
export { Button } from "./components/atoms/Button";
export type { ButtonProps } from "./components/atoms/Button";
export { Input } from "./components/atoms/Input";
export type { InputProps } from "./components/atoms/Input";
export {
	Sidebar,
	type SidebarItem,
	type SidebarProps,
	type SidebarTab,
} from "./components/organisms/Sidebar";
export { TabBar } from "./components/molecules/TabBar";
export type { TabBarProps, TabData } from "./components/molecules/TabBar";
export { Text } from "./components/atoms/Text";
export type { TextProps } from "./components/atoms/Text";
```

Note: `TabBar` and `TabData` are **new** public exports (not previously in the barrel).

- [ ] **Step 2: Verify full build and feature.sidebar-tabs**

```bash
cd /Users/me/Developer/ctrl.page && bun run build
```

Expected: Build succeeds. `feature.sidebar-tabs` compiles without changes.

---

### Task 13: Remove .gitkeep files and clean up empty directories

- [ ] **Step 1: Remove .gitkeep from populated directories, remove old empty dirs**

```bash
rm -f packages/libs/core.ui/src/components/atoms/.gitkeep
rm -f packages/libs/core.ui/src/components/molecules/.gitkeep
rm -f packages/libs/core.ui/src/components/organisms/.gitkeep
```

Keep `templates/.gitkeep` since it's empty.

- [ ] **Step 2: Commit**

```bash
git add -A packages/libs/core.ui/src/components/
git commit -m "chore(core.ui): clean up migration artifacts"
```

---

### Task 14: Update GritQL rule — allow per-component index.ts

**Files:**
- Modify: `.grit/patterns/single_index_per_package.md`

- [ ] **Step 1: Update the rule to allow component-level index.ts**

Replace `.grit/patterns/single_index_per_package.md`:

```markdown
---
title: Index files only at package root or component folders
level: error
tags: [quality, monorepo]
---

# Index files only at package root or component folders

Each package should have an `index.ts` at `src/index.ts`. Inside `core.ui`, per-component `index.ts` files are also allowed (for encapsulation). No other nested `index.ts` barrels.

```grit
language js

file($name, $body) where {
  $name <: includes "packages/libs/",
  $name <: includes "/index.ts",
  $name <: not includes "node_modules",
  $name <: not includes "/build/",
  $name <: not includes r"/src/index\.ts$",
  $name <: not includes r"/components/(atoms|molecules|organisms|templates)/[A-Z][^/]+/index\.ts$"
}
```
```

- [ ] **Step 2: Verify the rule passes**

```bash
bunx grit check .
```

Expected: No violations from the new component `index.ts` files.

- [ ] **Step 3: Commit**

```bash
git add .grit/patterns/single_index_per_package.md
git commit -m "chore: update GritQL rule to allow per-component index.ts in core.ui"
```

---

### Task 15: Add new GritQL rules — no-cva-in-core-ui

**Files:**
- Create: `.grit/patterns/no_cva_in_core_ui.md`

- [ ] **Step 1: Create the rule**

Create `.grit/patterns/no_cva_in_core_ui.md`:

```markdown
---
title: No cva in core.ui — use sva only
level: error
tags: [quality, core-ui]
---

# No cva in core.ui — use sva only

All component styles in core.ui must use `sva` (slot variant API), never `cva`.

```grit
language js

`cva($args)` where {
  $filename <: includes "packages/libs/core.ui/"
}
```
```

- [ ] **Step 2: Verify it catches violations**

```bash
bunx grit check .
```

Expected: No violations (all cva usages have been migrated).

- [ ] **Step 3: Commit**

```bash
git add .grit/patterns/no_cva_in_core_ui.md
git commit -m "chore: add GritQL rule enforcing sva-only in core.ui"
```

---

### Task 16: Add GritQL rule — atomic-import-boundary

**Files:**
- Create: `.grit/patterns/atomic_import_boundary.md`

- [ ] **Step 1: Create the rule**

Create `.grit/patterns/atomic_import_boundary.md`:

```markdown
---
title: Atomic design import boundary
level: error
tags: [quality, core-ui, architecture]
---

# Atomic design import boundary

Enforces one-way import dependencies in core.ui:
- atoms cannot import from molecules, organisms, or templates
- molecules cannot import from organisms or templates
- organisms cannot import from templates

```grit
language js

`import $_ from $path` where {
  $filename <: includes "packages/libs/core.ui/",
  or {
    // atoms importing from molecules/organisms/templates
    and {
      $filename <: includes "/atoms/",
      $path <: or { includes "molecules", includes "organisms", includes "templates" }
    },
    // molecules importing from organisms/templates
    and {
      $filename <: includes "/molecules/",
      $path <: or { includes "organisms", includes "templates" }
    },
    // organisms importing from templates
    and {
      $filename <: includes "/organisms/",
      $path <: includes "templates"
    }
  }
}
```
```

- [ ] **Step 2: Verify**

```bash
bunx grit check .
```

Expected: No violations.

- [ ] **Step 3: Commit**

```bash
git add .grit/patterns/atomic_import_boundary.md
git commit -m "chore: add GritQL rule enforcing atomic design import boundaries"
```

---

### Task 17: Add GritQL rule — styles-in-style-file-only

**Files:**
- Create: `.grit/patterns/styles_in_style_file_only.md`

- [ ] **Step 1: Create the rule**

Create `.grit/patterns/styles_in_style_file_only.md`:

```markdown
---
title: No sva/cva/css declarations in .tsx files
level: error
tags: [quality, core-ui]
---

# No sva/cva/css declarations in .tsx files

Style declarations must live in `.style.ts` files, not in `.tsx` component files.

```grit
language js

or {
  `sva($args)`,
  `cva($args)`,
  `css($args)`
} where {
  $filename <: includes "packages/libs/core.ui/",
  $filename <: includes ".tsx"
}
```
```

- [ ] **Step 2: Verify**

```bash
bunx grit check .
```

Expected: No violations (all style declarations moved to `.style.ts` files).

- [ ] **Step 3: Commit**

```bash
git add .grit/patterns/styles_in_style_file_only.md
git commit -m "chore: add GritQL rule — no style declarations in .tsx files"
```

---

### Task 18: Deferred GritQL rules

The following GritQL rules from the spec are **deferred** — they are only enforceable once Zag.js components are added (no Zag hooks exist yet in the migrated code):

- `zag-hook-pattern` — `lib/` hooks must use `useMachine` + `connect` + `normalizeProps`
- `no-raw-signals-for-machines` — no `createSignal` in `lib/use-xxx` hooks

These structural rules require more files to exist before they can be meaningfully tested:

- `component-required-files` — every component must have all 4 files in `ui/` (currently `.design.pen` files are placeholders)
- `component-requires-index` — already covered by updated `single_index_per_package` rule
- `component-naming-consistency` — PascalCase/kebab-case matching
- `lib-hook-structure` — hooks in `lib/use-xxx/use-xxx.ts`

And these need more thought on GritQL pattern matching:

- `no-cross-component-deep-import` — imports must go through `index.ts`
- `no-hardcoded-colors-in-styles` — no raw hex in `.style.ts` files
- `tokens-via-css-vars` — `panda.config.ts` tokens must use `var(--*)`

**These should be added as a follow-up task** once the first Zag.js interactive component is built and all `.design.pen` files are real.

---

### Task 19: Write COMPONENTS.md documentation

**Files:**
- Create: `packages/libs/core.ui/COMPONENTS.md`

- [ ] **Step 1: Create COMPONENTS.md**

Create `packages/libs/core.ui/COMPONENTS.md` with the following content — a concise guide covering:

1. Atomic hierarchy (atoms/molecules/organisms/templates) with import rules
2. Component folder structure (two tiers: simple vs interactive)
3. Required files checklist (`.tsx`, `.style.ts`, `.design.pen`, `.stories.tsx`, `index.ts`)
4. Naming conventions (PascalCase for folders/components, kebab-case for styles/design/hooks)
5. Style rules: `sva`-only, `$` convention, no styles in `.tsx`
6. Zag.js pattern: `useMachine` + `connect` + `normalizeProps` in `lib/use-xxx/`
7. Design tokens: CSS custom properties in `src/tokens/`, bidirectional sync with pencil.dev
8. Testing: stories required, interaction tests, machine unit tests for custom machines only
9. Step-by-step: adding a new simple component, adding a new interactive component

This should be a self-contained reference — an engineer reading only this file should know exactly how to create a new component.

- [ ] **Step 2: Commit**

```bash
git add packages/libs/core.ui/COMPONENTS.md
git commit -m "docs(core.ui): add COMPONENTS.md authoring guide"
```

---

### Task 20: Final verification

- [ ] **Step 1: Run full build**

```bash
cd /Users/me/Developer/ctrl.page && bun run build
```

Expected: Clean build, no errors.

- [ ] **Step 2: Run lint (includes GritQL)**

```bash
bun run lint
```

Expected: No violations from new rules.

- [ ] **Step 3: Run tests**

```bash
bun run test
```

Expected: All existing tests pass.

- [ ] **Step 4: Run Storybook to verify stories render**

```bash
cd packages/libs/core.ui && bunx storybook dev -p 6006
```

Expected: All stories under Atoms/, Molecules/, Organisms/ render correctly.
