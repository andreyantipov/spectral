# core.ui Component Authoring Guide

## 1. Atomic Hierarchy

Components live under `src/components/` in four levels:

| Level        | Purpose                                    | Examples                        |
|--------------|--------------------------------------------|---------------------------------|
| `atoms/`     | Foundational elements                      | Button, Text, Input, Icon       |
| `molecules/` | Compositions of atoms                      | TabBar, AddressBar, SearchInput |
| `organisms/` | Complex sections combining atoms/molecules | Sidebar, Toolbar                |
| `templates/` | Page-level layouts                         | BrowserLayout                   |

### Import Rules

Strict one-way dependency -- lower levels never import from higher levels:

- **atoms** -- cannot import from molecules, organisms, or templates
- **molecules** -- can import from atoms only
- **organisms** -- can import from atoms and molecules
- **templates** -- can import from atoms, molecules, and organisms

External imports (`solid-js`, `@zag-js/*`, `#styled-system/*`) are unrestricted.

These rules are enforced by the `atomic_import_boundary` GritQL rule.

## 2. Component Folder Structure

### Simple components (no state machine)

```
atoms/Button/
  ui/
    Button.tsx              # SolidJS component
    button.style.ts         # sva recipe
    button.design.pen       # pencil.dev design file
    Button.stories.tsx      # Storybook stories + interaction tests
  index.ts                  # Public exports
```

### Interactive components (Zag.js machine)

```
organisms/Sidebar/
  lib/
    use-sidebar/
      use-sidebar.ts        # useMachine + connect wrapper
      use-sidebar.test.ts   # Machine unit tests (custom machines only)
  ui/
    Sidebar.tsx
    sidebar.style.ts
    sidebar.design.pen
    Sidebar.stories.tsx
  index.ts
```

## 3. Required Files Checklist

Every component must have:

- [ ] `index.ts` at the component root (exports component + prop types)
- [ ] `ui/ComponentName.tsx` -- the SolidJS component
- [ ] `ui/component-name.style.ts` -- the sva recipe
- [ ] `ui/component-name.design.pen` -- pencil.dev design file
- [ ] `ui/ComponentName.stories.tsx` -- Storybook stories

For interactive components, additionally:

- [ ] `lib/use-component/use-component.ts` -- Zag.js hook
- [ ] `lib/use-component/use-component.test.ts` -- tests (for custom machines only)

## 4. Naming Conventions

| Item               | Convention     | Example               |
|--------------------|----------------|-----------------------|
| Component folder   | PascalCase     | `Button/`             |
| Component file     | PascalCase.tsx | `Button.tsx`          |
| Style file         | kebab-case     | `button.style.ts`     |
| Design file        | kebab-case     | `button.design.pen`   |
| Stories file       | PascalCase     | `Button.stories.tsx`  |
| Hook folder        | kebab-case     | `use-sidebar/`        |
| Hook file          | kebab-case     | `use-sidebar.ts`      |
| Hook test          | kebab-case     | `use-sidebar.test.ts` |

## 5. Style Rules

### sva-only

All styles use Panda CSS `sva` (slot variant API). Even single-slot components use `sva` with a `root` slot. Never use `cva`. Enforced by the `no_cva_in_core_ui` GritQL rule.

### The `$` convention

Style instances are assigned to `$` in component files:

```tsx
const $ = button({ variant: variants.variant, size: variants.size });
return <button class={$.root} {...rest} />;
```

For reactive variants (e.g., driven by a Zag machine or signal), `$` must be a function:

```tsx
const $ = () => sidebar({ collapsed: api().collapsed });
return <div class={$().root}>...</div>;
```

### No styles in .tsx files

Component `.tsx` files must not contain `sva()`, `cva()`, or `css()` calls. Import styles only from the sibling `.style.ts` file. Enforced by the `styles_in_style_file_only` GritQL rule.

**Exception**: Inline `style={}` is permitted for runtime-computed values that cannot be expressed as sva variants (e.g., pixel widths from drag-resize).

### Import path

Style files import from the generated `styled-system` using a relative path:

```ts
import { sva } from "../../../../../styled-system/css";
```

## 6. Zag.js Pattern for Interactive Components

Hooks live in `lib/use-component/` and follow this structure:

```ts
import * as dialog from "@zag-js/dialog";
import { normalizeProps, useMachine } from "@zag-js/solid";
import { createMemo, createUniqueId } from "solid-js";

export function useDialog(props?: Partial<dialog.Props>) {
  const service = useMachine(dialog.machine, { id: createUniqueId(), ...props });
  const api = createMemo(() => dialog.connect(service, normalizeProps));
  return api;
}
```

Rules:
- Always use `useMachine` + `connect` + `normalizeProps` -- no raw `createSignal` for machine state
- Spread Zag's `api().getXxxProps()` on elements -- never manually wire events
- Merge Zag's class with sva classes: `class={\`${$.trigger} ${zagClass ?? ""}\`}`
- `createSignal` is forbidden in hooks but permitted in `.tsx` for pure UI concerns (scroll, animation, drag)

## 7. Design Tokens and pencil.dev Workflow

### Token flow

```
pencil.dev variables <-> tokens/design-tokens.css <-> panda.config.ts -> sva styles
```

- `src/tokens/design-tokens.css` is the source of truth (CSS custom properties)
- `panda.config.ts` references CSS vars: `{ value: "var(--color-accent)" }`
- Styles use Panda semantic tokens: `bg: "accent"`, `color: "fg.primary"`
- Never hardcode color values in `.style.ts` files

### pencil.dev files

`.design.pen` files are JSON visual design files maintained by the pencil.dev editor. Do not hand-edit. Commit them alongside code so AI agents can reference both design and implementation.

## 8. Testing Strategy

- **Stories**: Every component has a `.stories.tsx` with representative variants and interaction tests
- **Pre-built Zag machines**: No unit tests needed (Zag tests them upstream)
- **Custom machines**: Unit tests required in `use-component.test.ts`
- **Integration**: Storybook interaction tests verify keyboard navigation and accessibility

## 9. Adding a New Component

1. **Decide the atomic level**: atom, molecule, organism, or template
2. **Create the folder**: `src/components/{level}/{ComponentName}/`
3. **Create `ui/` files**:
   - `ComponentName.tsx` -- SolidJS component using `splitProps` for variant props
   - `component-name.style.ts` -- `sva` recipe with `slots: ["root", ...]`
   - `component-name.design.pen` -- create via pencil.dev editor
   - `ComponentName.stories.tsx` -- cover all variants and sizes
4. **If interactive**, create `lib/use-component/use-component.ts` with Zag.js hook
5. **Create `index.ts`** -- export component and prop types
6. **Update `src/index.ts`** -- add the component to the package barrel
7. **Verify**: Run `bunx grit check .` to confirm all rules pass
8. **Verify**: Run `bun run build` to confirm the build passes
