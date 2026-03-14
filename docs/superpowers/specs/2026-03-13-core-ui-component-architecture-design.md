# core.ui Component Architecture Design

## Overview

Defines the component authoring convention for `packages/libs/core.ui` — the shared UI library for ctrl.page. Establishes a structured, enforceable approach to building components using Zag.js state machines, Panda CSS styling with `sva`, SolidJS composition, pencil.dev design files, and Atomic Design hierarchy with strict import boundaries.

## Goals

- Every component follows one convention — no ambiguity about where code goes or how it's structured
- Clean separation of concerns: business logic (Zag machine) / design (Panda CSS `sva`) / composition (SolidJS)
- Atomic Design import boundaries prevent architectural erosion over time
- Design tokens flow bidirectionally between pencil.dev and code
- GritQL enforces both structural and code pattern rules automatically

## Non-Goals

- Feature-level architecture (e.g., `feature.sidebar-tabs`) — separate design effort
- Hexagonal architecture for app layer — separate design effort
- Building a full pencil.dev UI kit — the kit emerges organically from core.ui components

---

## 1. Atomic Design Hierarchy

Components are organized into four levels under `packages/libs/core.ui/src/components/`:

```
components/
├── atoms/          # Foundational elements (Button, Text, Input, Icon)
├── molecules/      # Compositions of atoms (SearchInput, TabBar, AddressBar)
├── organisms/      # Complex sections (Sidebar, Toolbar)
└── templates/      # Page-level layouts (BrowserLayout)
```

### Import Boundary Rules

Strict one-way dependency — lower levels cannot import from higher levels:

| Level      | Can import from                     |
|------------|-------------------------------------|
| atoms      | nothing from core.ui components     |
| molecules  | atoms only                          |
| organisms  | atoms, molecules                    |
| templates  | atoms, molecules, organisms         |

External imports (solid-js, @zag-js/*, styled-system, etc.) are unrestricted at all levels.

---

## 2. Component Folder Structure

### Two Tiers

**Simple components** (no state machine — e.g., Button, Text):

```
atoms/Button/
├── ui/
│   ├── Button.tsx                # SolidJS composition
│   ├── button.style.ts           # sva recipe (sole source of styles)
│   ├── button.design.pen         # pencil.dev design file
│   └── Button.stories.tsx        # Stories + interaction tests
└── index.ts                      # Encapsulation export
```

**Interactive components** (Zag.js machine — e.g., Dialog, Combobox):

```
organisms/Sidebar/
├── lib/
│   └── use-sidebar/
│       ├── use-sidebar.ts        # useMachine + connect wrapper
│       └── use-sidebar.test.ts   # Machine unit tests
├── ui/
│   ├── Sidebar.tsx               # SolidJS composition
│   ├── sidebar.style.ts          # sva recipe
│   ├── sidebar.design.pen        # pencil.dev design file
│   └── Sidebar.stories.tsx       # Stories + interaction tests
└── index.ts                      # Encapsulation export
```

### Naming Rules

| File                    | Convention      | Example                  |
|-------------------------|-----------------|--------------------------|
| Component folder        | PascalCase      | `Button/`                |
| Component file          | PascalCase.tsx  | `Button.tsx`             |
| Style file              | kebab-case      | `button.style.ts`        |
| Design file             | kebab-case      | `button.design.pen`      |
| Stories file            | PascalCase      | `Button.stories.tsx`     |
| Hook folder             | kebab-case      | `use-sidebar/`           |
| Hook file               | kebab-case      | `use-sidebar.ts`         |
| Hook test               | kebab-case      | `use-sidebar.test.ts`    |

### Required Files

Every component folder in `ui/` must contain exactly four files:
- `ComponentName.tsx`
- `component-name.style.ts`
- `component-name.design.pen`
- `ComponentName.stories.tsx`

Every component folder must have an `index.ts` at its root.

### pencil.dev Design Files

`.design.pen` files are JSON-based visual design files generated and maintained by the pencil.dev editor. They describe the visual structure (frames, colors, typography, spacing) of a component. Do not hand-edit — use the pencil.dev editor or CLI to create and update them. They are committed to the repo alongside code so that AI agents can reference both design and implementation.

### Barrel Exports

- **Per-component `index.ts`** — encapsulation only; hides `ui/` and `lib/` internals
- **No level-wide barrels** — no `atoms/index.ts` aggregation
- **Package-level `index.ts`** (`core.ui/src/index.ts`) — the only true barrel, explicit per-component re-exports for external consumers

```ts
// core.ui/src/index.ts
export { Button } from "./components/atoms/Button"
export { Icon } from "./components/atoms/Icon"
export { SearchInput } from "./components/molecules/SearchInput"
export { Sidebar } from "./components/organisms/Sidebar"
```

Internal cross-level imports reference components directly:

```ts
// molecule importing atoms — tree-shakeable, explicit
import { Button } from "../../atoms/Button"
import { Icon } from "../../atoms/Icon"
```

---

## 3. Style System

### sva-only Rule

All component styles use Panda CSS `sva` (slot variant API). No `cva`. No exceptions.

Even single-slot components like Button use `sva` with a `root` slot for consistency.

**Import path**: Style files import from Panda's generated `styled-system`. Consider adding a tsconfig path alias (e.g., `@styled-system/css`) to avoid fragile relative paths like `../../../styled-system/css` that break when folder depth changes.

```ts
// button.style.ts
import { sva } from "../../../styled-system/css"  // or @styled-system/css with path alias

export const button = sva({
  slots: ["root"],
  base: {
    root: {
      display: "inline-flex",
      alignItems: "center",
      cursor: "pointer",
      borderRadius: "md",
    },
  },
  variants: {
    variant: {
      solid: { root: { bg: "accent", color: "fg.primary" } },
      outline: { root: { bg: "transparent", borderColor: "border" } },
      ghost: { root: { bg: "transparent", color: "fg.secondary" } },
    },
    size: {
      sm: { root: { height: "32px", px: "12px", fontSize: "13px" } },
      md: { root: { height: "38px", px: "16px", fontSize: "14px" } },
    },
  },
  defaultVariants: { variant: "solid", size: "md" },
})
```

### `$` Convention

Style instances are assigned to `$` in component files — short, distinctive, one per component.

**Static variants** (variant selection known at render time):

```tsx
// Button.tsx
import { splitProps, type JSX } from "solid-js"
import { button } from "./button.style"

type ButtonProps = { variant?: "solid" | "outline" | "ghost"; size?: "sm" | "md" }
  & JSX.ButtonHTMLAttributes<HTMLButtonElement>

export function Button(props: ButtonProps) {
  const [variants, rest] = splitProps(props, ["variant", "size"])
  const $ = button({ variant: variants.variant, size: variants.size })
  return <button class={$.root} {...rest} />
}
```

**Reactive variants** (variant selection depends on signals):

When variant props are reactive (e.g., driven by a Zag machine or signal), `$` must be a function to preserve SolidJS reactivity:

```tsx
// Sidebar.tsx
const $ = () => sidebar({ collapsed: api().collapsed, position: position() })
return <div class={$().root}>...</div>
```

### No Styles in .tsx Files

Component `.tsx` files must not contain:
- `sva()`, `cva()`, or `css()` calls
- Any style declaration

The only style reference is the import from the sibling `.style.ts` file.

**Exception — dynamic computed values**: Inline `style={}` is permitted only for values that must be computed at runtime and cannot be expressed as `sva` variants (e.g., pixel widths from drag-resize, dynamic indentation). These should be limited to CSS custom property assignments where possible:

```tsx
// Permitted: runtime-computed value that can't be an sva variant
<div style={{ width: `${width()}px` }} class={$.panel} />
```

### Type Exports

Component prop types should be inferred from the `sva` recipe using Panda's `RecipeVariantProps` to avoid duplication, and exported alongside the component from the component's `index.ts`:

```ts
// atoms/Button/index.ts
export { Button } from "./ui/Button"
export type { ButtonProps } from "./ui/Button"
```

---

## 4. Zag.js Integration

### Packages

- `@zag-js/solid` — SolidJS framework adapter
- Individual machine packages as needed: `@zag-js/dialog`, `@zag-js/tabs`, `@zag-js/combobox`, etc.

### Hook Pattern

All Zag hooks live in `lib/use-component/use-component.ts` and follow this structure:

```ts
// lib/use-dialog/use-dialog.ts
import * as dialog from "@zag-js/dialog"
import { normalizeProps, useMachine } from "@zag-js/solid"
import { createMemo, createUniqueId } from "solid-js"

export function useDialog(props?: Partial<dialog.Props>) {
  const service = useMachine(dialog.machine, { id: createUniqueId(), ...props })
  const api = createMemo(() => dialog.connect(service, normalizeProps))
  return api
}
```

### Composition

Interactive components wire `api()` for behavior and `$` for appearance:

```tsx
// Dialog.tsx
import { Show } from "solid-js"
import { useDialog } from "../lib/use-dialog/use-dialog"
import { dialog } from "./dialog.style"

export function Dialog(props) {
  const api = useDialog()
  const $ = dialog()
  return (
    <Show when={api().open}>
      <div {...api().getBackdropProps()} class={$.backdrop} />
      <div {...api().getPositionerProps()}>
        <div {...api().getContentProps()} class={$.content}>
          {props.children}
        </div>
      </div>
    </Show>
  )
}
```

### Zag Props and Style Class Merging

Zag's `api().getXxxProps()` may return a `class` property. To merge with `sva` classes, destructure and combine:

```tsx
const { class: zagClass, ...triggerProps } = api().getTriggerProps()
<button {...triggerProps} class={`${$.trigger} ${zagClass ?? ""}`} />
```

### Rules

- Zag hooks must use `useMachine` + `connect` + `normalizeProps` — no raw `createSignal` for machine state
- Components must spread Zag's `api().getXxxProps()` — never manually wire events the machine provides
- Pre-built Zag machines: no unit tests needed (Zag tests them)
- Custom machines: unit tests required in co-located `use-component.test.ts`

### Local UI State vs. Machine State

`createSignal` is forbidden in `lib/use-xxx` hooks (machine state must come from Zag). However, `createSignal` is permitted in `.tsx` component files for pure UI concerns that don't map to a state machine — e.g., drag-resize tracking, scroll position, animation state. These signals stay local to the component and are not exposed via the hook.

---

## 5. Accessibility

Zag.js provides ARIA attributes, keyboard interactions, and focus management out of the box for interactive components. Rules:

- Never override or remove ARIA attributes provided by `api().getXxxProps()`
- Simple components (atoms without Zag) must follow WAI-ARIA patterns where applicable (e.g., Button should support `aria-disabled`, Input should associate labels)
- Interaction tests in stories should verify keyboard navigation works

---

## 6. Design Token System

### Architecture

```
pencil.dev variables ←→ tokens/design-tokens.css ←→ panda.config.ts → sva styles
```

### Token Files

Located inside `src/` alongside components (not at the package root):

```
packages/libs/core.ui/src/tokens/
├── design-tokens.css          # Source of truth — CSS custom properties
└── themes/
    ├── dark.css               # Dark theme (current default)
    └── light.css              # Light theme (future)
```

### Token Format (CSS Custom Properties)

```css
/* design-tokens.css */
:root {
  /* Background */
  --color-bg-primary: #0a0a0a;
  --color-bg-secondary: #141414;
  --color-bg-tertiary: #1e1e1e;

  /* Foreground */
  --color-fg-primary: #fafafa;
  --color-fg-secondary: #a0a0a0;
  --color-fg-muted: #666666;

  /* Accent */
  --color-accent: #3b82f6;
  --color-accent-hover: #2563eb;
  --color-accent-active: #1d4ed8;

  /* Border */
  --color-border: #2a2a2a;
  --color-border-hover: #3a3a3a;

  /* Typography */
  --font-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'SF Mono', 'Fira Code', Menlo, monospace;

  /* Radii */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}
```

### Panda CSS Consumption

`panda.config.ts` references CSS custom properties, never hardcoded values:

```ts
import { defineConfig } from "@pandacss/dev"

export default defineConfig({
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
      },
    },
  },
})
```

### Bidirectional Sync with pencil.dev

- **Pencil → Code**: Update variables in pencil.dev → sync to `design-tokens.css` → Panda picks up changes
- **Code → Pencil**: Edit `design-tokens.css` → tell pencil.dev AI "create variables from my design-tokens.css" → `.pen` files update

---

## 7. Testing Strategy

| Component type          | Stories | Interaction tests | Machine unit tests |
|-------------------------|---------|-------------------|--------------------|
| Simple (no machine)     | Yes     | Yes               | N/A                |
| Interactive (pre-built) | Yes     | Yes               | No (Zag tests it)  |
| Interactive (custom)    | Yes     | Yes               | Yes                |

- **Stories** (`ComponentName.stories.tsx`): Visual documentation, variant showcase, regression baseline
- **Interaction tests**: Storybook play functions testing click, keyboard, a11y in the browser
- **Machine unit tests** (`use-component.test.ts`): State transitions, guards, actions — pure logic, no DOM

Stories use `storybook-solidjs` and `storybook-solidjs-vite` (already configured in the project).

---

## 8. GritQL Rules

### Structural Rules

| Rule                            | Enforces                                                                                   |
|---------------------------------|--------------------------------------------------------------------------------------------|
| `component-required-files`      | Every component in `ui/` must have `.tsx`, `.style.ts`, `.design.pen`, `.stories.tsx`       |
| `component-requires-index`      | Every component folder must have `index.ts` at root                                        |
| `component-naming-consistency`  | Folder PascalCase matches `.tsx`/`.stories.tsx`; kebab-case matches `.style.ts`/`.design.pen` |
| `lib-hook-structure`            | Hooks in `lib/use-xxx/use-xxx.ts`; `use-xxx.test.ts` required for custom machines only     |

### Code Pattern Rules

| Rule                              | Enforces                                                                      |
|-----------------------------------|-------------------------------------------------------------------------------|
| `no-cva-in-core-ui`              | No `cva` imports — only `sva` in style files                                  |
| `styles-in-style-file-only`      | No `sva`/`cva`/`css()` in `.tsx`; inline `style={}` only for dynamic computed values |
| `zag-hook-pattern`               | `lib/` hooks must use `useMachine` + `connect` + `normalizeProps`             |
| `no-raw-signals-for-machines`    | No `createSignal` in `lib/use-xxx` hooks for machine state                    |
| `atomic-import-boundary`         | Atoms can't import molecules+; molecules can't import organisms+; etc.        |
| `no-cross-component-deep-import` | Components import via `index.ts`, never reaching into `ui/` or `lib/` directly |
| `no-hardcoded-colors-in-styles`  | Style files use Panda token names, never raw hex values                        |
| `tokens-via-css-vars`            | `panda.config.ts` tokens reference `var(--*)`, not inline values              |

### Integration

Rules run via `bunx grit check .` — already wired into the `lint` script alongside Biome.

---

## 9. Migration Plan (Existing Components)

### Migration Order

Migrate bottom-up (atoms first, then molecules, then organisms) since higher levels depend on lower:

1. Design token system (`src/tokens/`, update `panda.config.ts` to use CSS vars)
2. Atoms (Button, Text, Input)
3. Molecules (TabBar, AddressBar)
4. Organisms (Sidebar)

### Current components to restructure:

| Component   | Target level | Changes needed                                                         |
|-------------|-------------|------------------------------------------------------------------------|
| Button      | atoms       | Move to `atoms/Button/ui/`, convert `cva` → `sva`, add `.design.pen`  |
| Text        | atoms       | Move to `atoms/Text/ui/`, add `.style.ts`, `.design.pen`              |
| Input       | atoms       | Move to `atoms/Input/ui/`, add `.style.ts`, `.design.pen`             |
| TabBar      | molecules   | Move to `molecules/TabBar/ui/`, already has `sva`, add `.design.pen`  |
| AddressBar  | molecules   | Move to `molecules/AddressBar/ui/`, add `.style.ts`, `.design.pen`    |
| Sidebar     | organisms   | Move to `organisms/Sidebar/ui/`, extract machine to `lib/`, has `.design.pen` |

### panda.config.ts Migration

The current `panda.config.ts` uses hardcoded hex values. As part of migration step 1, all token values must be updated to reference CSS custom properties from `design-tokens.css`. This is a prerequisite — the GritQL rule `tokens-via-css-vars` will fail on the current config.

### Dependencies to Add

- `@zag-js/solid` — SolidJS adapter
- Individual `@zag-js/*` machine packages as needed

### No External Breaking Changes

The package barrel `@ctrl/core.ui` re-exports stay the same. Feature packages won't notice the internal restructuring.

---

## 10. Documentation

A `COMPONENTS.md` guide in `packages/libs/core.ui/` covering:
- Component folder structure convention (both tiers)
- Atomic design levels and import boundary rules
- Required files checklist
- Code patterns: `sva`-only, `$` convention, Zag `useMachine` + `connect` pattern
- Step-by-step: how to add a new component
- Design token workflow with pencil.dev
