# Code Quality Stack Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Biome (formatting + linting), GritQL (custom structural rules), and Lefthook (pre-commit hooks) to enforce code quality across the ctrl.page monorepo.

**Architecture:** Two lint layers (Biome for formatting/standard rules, GritQL for codebase-specific structural patterns) gated by Lefthook pre-commit hooks. All config lives at repo root. Lint scripts run directly (not through Turbo).

**Tech Stack:** Biome, GritQL (@getgrit/cli), Lefthook, Bun, Turborepo

---

## Chunk 1: Biome Setup

### Task 1: Install Biome

**Files:**
- Modify: `/Users/me/Developer/ctrl.page/package.json`

- [ ] **Step 1: Install Biome as root devDependency**

Run:
```bash
cd /Users/me/Developer/ctrl.page && bun add -d @biomejs/biome
```

- [ ] **Step 2: Verify installation**

Run:
```bash
cd /Users/me/Developer/ctrl.page && bunx biome --version
```
Expected: Version number printed

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add biome dependency"
```

### Task 2: Create Biome config

**Files:**
- Create: `/Users/me/Developer/ctrl.page/biome.json`

- [ ] **Step 1: Create biome.json at repo root**

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "complexity": {
        "noExcessiveCognitiveComplexity": "warn"
      },
      "suspicious": {
        "noExplicitAny": "error",
        "noConsoleLog": "warn"
      },
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error"
      },
      "style": {
        "useConsistentArrayType": {
          "level": "error",
          "options": { "syntax": "shorthand" }
        }
      }
    }
  },
  "files": {
    "ignore": [
      "node_modules",
      "dist",
      "build",
      "styled-system",
      ".turbo",
      ".grit",
      "*.config.ts",
      "*.config.js",
      "drizzle"
    ]
  },
  "overrides": [
    {
      "include": ["*.stories.tsx"],
      "linter": {
        "rules": {
          "suspicious": {
            "noConsoleLog": "off"
          }
        }
      }
    }
  ]
}
```

- [ ] **Step 2: Run biome check to see current state**

Run:
```bash
cd /Users/me/Developer/ctrl.page && bunx biome check .
```
Expected: List of formatting/lint issues in existing code. Note the count — we'll fix these next.

- [ ] **Step 3: Commit config**

```bash
git add biome.json
git commit -m "chore: add biome configuration"
```

### Task 3: Fix existing code to pass Biome

**Files:**
- Modify: All `.ts`, `.tsx`, `.json` files in `packages/`

- [ ] **Step 1: Auto-fix all formatting and safe lint fixes**

Run:
```bash
cd /Users/me/Developer/ctrl.page && bunx biome check --write .
```

- [ ] **Step 2: Review changes**

Run:
```bash
git diff --stat
```
Review the changes to make sure nothing looks wrong. Biome's auto-fixes are safe but worth a glance.

- [ ] **Step 3: Handle any remaining manual fixes**

Run:
```bash
cd /Users/me/Developer/ctrl.page && bunx biome check .
```
If there are remaining errors that can't be auto-fixed, fix them manually. Common issues:
- `noExplicitAny`: Replace `any` with proper types or `unknown`
- `noUnusedVariables`: Remove or prefix with `_`

- [ ] **Step 4: Verify clean check**

Run:
```bash
cd /Users/me/Developer/ctrl.page && bunx biome check .
```
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "style: format and lint existing code with biome"
```

### Task 4: Add lint scripts to root package.json

**Files:**
- Modify: `/Users/me/Developer/ctrl.page/package.json`

- [ ] **Step 1: Update root package.json scripts**

Add/update these scripts:
```json
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "fmt": "biome format --write ."
  }
}
```

Keep existing scripts (`dev`, `dev:desktop`, `build`, `check`, `test`) unchanged.

- [ ] **Step 2: Verify scripts work**

Run:
```bash
cd /Users/me/Developer/ctrl.page && bun run lint
```
Expected: Clean output, no errors

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add lint and fmt scripts"
```

---

## Chunk 2: Remove component barrel index.ts files

Before adding the GritQL single-index rule, refactor `core.ui` to eliminate per-component `index.ts` barrel files.

### Task 5: Remove barrel index.ts files from core.ui components

**Files:**
- Delete: `/Users/me/Developer/ctrl.page/packages/libs/core.ui/src/components/Sidebar/index.ts`
- Delete: `/Users/me/Developer/ctrl.page/packages/libs/core.ui/src/components/Button/index.ts`
- Delete: `/Users/me/Developer/ctrl.page/packages/libs/core.ui/src/components/Input/index.ts`
- Delete: `/Users/me/Developer/ctrl.page/packages/libs/core.ui/src/components/TabBar/index.ts`
- Delete: `/Users/me/Developer/ctrl.page/packages/libs/core.ui/src/components/AddressBar/index.ts`
- Delete: `/Users/me/Developer/ctrl.page/packages/libs/core.ui/src/components/Text/index.ts`
- Modify: `/Users/me/Developer/ctrl.page/packages/libs/core.ui/src/index.ts`

- [ ] **Step 1: Update root index.ts to import directly from component files**

Change `/Users/me/Developer/ctrl.page/packages/libs/core.ui/src/index.ts` to:

```typescript
export { Button } from "./components/Button/Button";
export { Text } from "./components/Text/Text";
export { Input } from "./components/Input/Input";
export { AddressBar } from "./components/AddressBar/AddressBar";
export {
	Sidebar,
	type SidebarTab,
	type SidebarItem,
	type SidebarProps,
} from "./components/Sidebar/Sidebar";
```

- [ ] **Step 2: Check if any stories import from barrel files**

Run:
```bash
cd /Users/me/Developer/ctrl.page && grep -r "from \"\./index\"" packages/libs/core.ui/src/ || echo "No barrel imports found"
grep -r "from \"\.\.\"" packages/libs/core.ui/src/ || echo "No parent barrel imports found"
```

If stories import from `"../"` or `"./index"`, update them to import from the component file directly (e.g., `import { Button } from "./Button"`).

- [ ] **Step 3: Delete all component barrel index.ts files**

```bash
cd /Users/me/Developer/ctrl.page
rm packages/libs/core.ui/src/components/Sidebar/index.ts
rm packages/libs/core.ui/src/components/Button/index.ts
rm packages/libs/core.ui/src/components/Input/index.ts
rm packages/libs/core.ui/src/components/TabBar/index.ts
rm packages/libs/core.ui/src/components/AddressBar/index.ts
rm packages/libs/core.ui/src/components/Text/index.ts
```

- [ ] **Step 4: Verify build still works**

Run:
```bash
cd /Users/me/Developer/ctrl.page && bun run build
```
Expected: Build succeeds. Consumers import from `@ctrl/core.ui` (the package), so they're unaffected.

- [ ] **Step 5: Verify type check passes**

Run:
```bash
cd /Users/me/Developer/ctrl.page && bun run check
```
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove component barrel index.ts files in core.ui"
```

---

## Chunk 3: GritQL Setup

### Task 6: Initialize GritQL

**Files:**
- Create: `/Users/me/Developer/ctrl.page/.grit/.gitignore`
- Modify: `/Users/me/Developer/ctrl.page/.gitignore`

- [ ] **Step 1: Install grit CLI**

Run:
```bash
cd /Users/me/Developer/ctrl.page && bun add -d @getgrit/cli
```

- [ ] **Step 2: Initialize grit**

Run:
```bash
cd /Users/me/Developer/ctrl.page && bunx grit init
```

- [ ] **Step 3: Add gritmodules to .grit/.gitignore**

Create `/Users/me/Developer/ctrl.page/.grit/.gitignore`:
```
gritmodules/
```

- [ ] **Step 4: Commit**

```bash
git add .grit package.json
git commit -m "chore: initialize gritql"
```

### Task 7: Create GritQL rule — no-console-log

**Files:**
- Create: `/Users/me/Developer/ctrl.page/.grit/patterns/no_console_log.md`

- [ ] **Step 1: Create the pattern file**

```markdown
---
title: No console.log
level: error
tags: [quality]
---

# No console.log

Use `console.error` or `console.warn` for legitimate output. Remove debug logging.

```grit
language js

`console.log($args)` => .
`` `
```

- [ ] **Step 2: Test the rule**

Run:
```bash
cd /Users/me/Developer/ctrl.page && bunx grit check . --pattern no_console_log
```
Expected: Lists any `console.log` calls in the codebase. Fix any that appear in production code (not stories/scripts).

- [ ] **Step 3: Fix any violations**

If violations are found, either remove `console.log` calls or replace with `console.error`/`console.warn` as appropriate.

- [ ] **Step 4: Commit**

```bash
git add .grit/patterns/no_console_log.md
git commit -m "chore: add gritql no-console-log rule"
```

### Task 8: Create GritQL rule — effect-no-raw-promises

**Files:**
- Create: `/Users/me/Developer/ctrl.page/.grit/patterns/effect_no_raw_promises.md`

- [ ] **Step 1: Create the pattern file**

```markdown
---
title: No raw async/await in Effect bun layer
level: error
tags: [quality, effect]
---

# No raw async/await in bun layer

Files in `src/bun/` use the Effect library for error handling. Use `Effect.gen` instead of raw `async/await` to keep error handling consistent.

```grit
language js

`async function $name($args) { $body }` where {
  $filename <: includes "src/bun/"
}
`` `
```

- [ ] **Step 2: Test the rule**

Run:
```bash
cd /Users/me/Developer/ctrl.page && bunx grit check packages/apps/desktop/src/bun/ --pattern effect_no_raw_promises
```
Expected: May find violations in existing code. Review each — some may need `// grit-ignore` if they're intentional (e.g., top-level bootstrap).

- [ ] **Step 3: Commit**

```bash
git add .grit/patterns/effect_no_raw_promises.md
git commit -m "chore: add gritql effect-no-raw-promises rule"
```

### Task 9: Create GritQL rule — solid-tsx-only

**Files:**
- Create: `/Users/me/Developer/ctrl.page/.grit/patterns/solid_tsx_only.md`

- [ ] **Step 1: Create the pattern file**

```markdown
---
title: JSX must be in .tsx files
level: error
tags: [quality, solid]
---

# JSX must be in .tsx files

Solid.js components that use JSX syntax must have a `.tsx` extension.

```grit
language js

or {
  `<$tag $attrs>$children</$tag>`,
  `<$tag $attrs />`
} where {
  $filename <: not includes ".tsx"
}
`` `
```

- [ ] **Step 2: Test the rule**

Run:
```bash
cd /Users/me/Developer/ctrl.page && bunx grit check . --pattern solid_tsx_only
```
Expected: No violations (all JSX files already use `.tsx`)

- [ ] **Step 3: Commit**

```bash
git add .grit/patterns/solid_tsx_only.md
git commit -m "chore: add gritql solid-tsx-only rule"
```

### Task 10: Create GritQL rule — single-index-per-package

**Files:**
- Create: `/Users/me/Developer/ctrl.page/.grit/patterns/single_index_per_package.md`

- [ ] **Step 1: Create the pattern file**

GritQL's `file($name, $body)` pattern and `$filename` metavariable allow matching against file paths. This rule flags any `index.ts` file nested inside a subdirectory of a package's `src/` — only `src/index.ts` is allowed.

```markdown
---
title: Single index.ts per package
level: error
tags: [quality, monorepo]
---

# Single index.ts per package

Each package should have exactly one `index.ts` at `src/index.ts`. Nested `index.ts` barrel files (e.g., `src/components/Button/index.ts`) are not allowed — import directly from the component file instead.

```grit
language js

file($name, $body) where {
  $name <: includes "packages/",
  $name <: includes "/index.ts",
  $name <: not includes r"packages/[^/]+/[^/]+/src/index\.ts$"
}
`` `
```

- [ ] **Step 2: Test the rule**

Run:
```bash
cd /Users/me/Developer/ctrl.page && bunx grit check . --pattern single_index_per_package
```
Expected: No violations (after Task 5 removed the barrel files)

- [ ] **Step 3: Commit**

```bash
git add .grit/patterns/single_index_per_package.md
git commit -m "chore: add gritql single-index-per-package rule"
```

### Task 10b: Consolidate all dependencies to root package.json

All dependencies live in root `package.json`. Package-level `package.json` files only contain `name`, `version`, `private`, `type`, `scripts`, and `workspace:*` references.

**Files:**
- Modify: `/Users/me/Developer/ctrl.page/package.json`
- Modify: `/Users/me/Developer/ctrl.page/packages/apps/desktop/package.json`
- Modify: `/Users/me/Developer/ctrl.page/packages/libs/core.ui/package.json`
- Modify: `/Users/me/Developer/ctrl.page/packages/libs/core.shared/package.json`
- Modify: `/Users/me/Developer/ctrl.page/packages/libs/core.db/package.json`
- Modify: `/Users/me/Developer/ctrl.page/packages/libs/feature.sidebar-tabs/package.json`

- [ ] **Step 1: Move all package deps to root package.json**

Add to root `package.json` dependencies:
```json
{
  "dependencies": {
    "solid-js": "latest",
    "effect": "latest",
    "@effect/platform": "latest",
    "@effect/platform-bun": "latest",
    "electrobun": "latest",
    "@libsql/client": "latest",
    "drizzle-orm": "latest"
  },
  "devDependencies": {
    "turbo": "latest",
    "@typescript/native-preview": "latest",
    "@biomejs/biome": "latest",
    "@getgrit/cli": "latest",
    "lefthook": "latest",
    "@pandacss/dev": "latest",
    "@dschz/bun-plugin-solid": "latest",
    "@types/bun": "latest",
    "drizzle-kit": "latest",
    "storybook": "latest",
    "storybook-solidjs": "latest",
    "storybook-solidjs-vite": "latest",
    "vite": "latest",
    "vite-plugin-solid": "latest",
    "@storybook/addon-essentials": "latest",
    "@storybook/addon-links": "latest"
  }
}
```

- [ ] **Step 2: Strip deps from package-level package.json files**

Remove `dependencies` and `devDependencies` from each package's `package.json`. Keep only: `name`, `version`, `private`, `type`, `scripts`, and `workspace:*` references in `dependencies` (for Turbo task ordering).

For example, `packages/apps/desktop/package.json` becomes:
```json
{
  "name": "@ctrl/desktop",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "dependencies": {
    "@ctrl/core.shared": "workspace:*",
    "@ctrl/core.ui": "workspace:*",
    "@ctrl/core.db": "workspace:*",
    "@ctrl/feature.sidebar-tabs": "workspace:*"
  },
  "scripts": { ... }
}
```

Apply same pattern to all other packages — keep `workspace:*` refs, remove everything else.

- [ ] **Step 3: Reinstall**

Run:
```bash
cd /Users/me/Developer/ctrl.page && rm -rf node_modules packages/*/node_modules packages/*/*/node_modules && bun install
```

- [ ] **Step 4: Verify build works**

Run:
```bash
cd /Users/me/Developer/ctrl.page && bun run build
```
Expected: Build succeeds

- [ ] **Step 5: Verify type check passes**

Run:
```bash
cd /Users/me/Developer/ctrl.page && bun run check
```
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: consolidate all dependencies to root package.json"
```

### Task 10c: Create GritQL rule — no-package-deps

**Files:**
- Create: `/Users/me/Developer/ctrl.page/.grit/patterns/no_package_deps.md`

- [ ] **Step 1: Create the pattern file**

```markdown
---
title: No dependencies in package-level package.json
level: error
tags: [quality, monorepo]
---

# No dependencies in package-level package.json

All dependencies must be declared in the root `package.json`. Package-level `package.json` files may only contain `workspace:*` references for Turbo task ordering.

```grit
language json

`"dependencies": { $deps }` where {
  $filename <: includes "packages/",
  $deps <: not includes "workspace"
}

`"devDependencies": { $deps }` where {
  $filename <: includes "packages/"
}
`` `
```

- [ ] **Step 2: Test the rule**

Run:
```bash
cd /Users/me/Developer/ctrl.page && bunx grit check . --pattern no_package_deps
```
Expected: No violations (after Task 10b consolidated deps)

- [ ] **Step 3: Commit**

```bash
git add .grit/patterns/no_package_deps.md
git commit -m "chore: add gritql no-package-deps rule"
```

---

## Chunk 4: Lefthook + Script Integration

### Task 11: Install and configure Lefthook

**Files:**
- Create: `/Users/me/Developer/ctrl.page/lefthook.yml`
- Modify: `/Users/me/Developer/ctrl.page/package.json`
- Modify: `/Users/me/Developer/ctrl.page/.gitignore`

- [ ] **Step 1: Install lefthook**

Run:
```bash
cd /Users/me/Developer/ctrl.page && bun add -d lefthook
```

- [ ] **Step 2: Create lefthook.yml**

```yaml
pre-commit:
  parallel: false
  commands:
    biome:
      glob: "*.{ts,tsx,json}"
      run: bunx biome check --staged --no-errors-on-unmatched
      stage_fixed: true
    grit:
      glob: "*.{ts,tsx,json}"
      run: bunx grit check {staged_files}
    typecheck:
      run: bun run check
```

- [ ] **Step 3: Install the git hook**

Run:
```bash
cd /Users/me/Developer/ctrl.page && bunx lefthook install
```
Expected: `SYNCED` message confirming hook installed

- [ ] **Step 4: Commit**

```bash
git add lefthook.yml package.json
git commit -m "chore: add lefthook pre-commit hooks"
```

### Task 12: Update root scripts and turbo config

**Files:**
- Modify: `/Users/me/Developer/ctrl.page/package.json`
- Modify: `/Users/me/Developer/ctrl.page/turbo.json`

- [ ] **Step 1: Update root package.json lint script to include grit**

Update the `lint` script:
```json
{
  "scripts": {
    "lint": "biome check . && bunx grit check .",
    "lint:fix": "biome check --write .",
    "fmt": "biome format --write ."
  }
}
```

- [ ] **Step 2: Verify full lint passes**

Run:
```bash
cd /Users/me/Developer/ctrl.page && bun run lint
```
Expected: All checks pass

- [ ] **Step 3: Commit**

```bash
git add package.json turbo.json
git commit -m "chore: update lint scripts with biome + grit"
```

### Task 13: End-to-end verification

- [ ] **Step 1: Verify pre-commit hook works — clean commit**

Make a trivial change (e.g., add a comment to a file), stage and commit:
```bash
cd /Users/me/Developer/ctrl.page
echo "// test" >> packages/libs/core.shared/src/index.ts
git add packages/libs/core.shared/src/index.ts
git commit -m "test: verify pre-commit hook"
```
Expected: Lefthook runs biome, grit, and typecheck. Commit succeeds.

- [ ] **Step 2: Revert the test commit**

```bash
git revert --no-edit HEAD
```

- [ ] **Step 3: Verify pre-commit hook catches violations**

Create a file with a violation:
```bash
echo "const x: any = 1; console.log(x);" > /tmp/test-violation.ts
```
Verify biome would catch it:
```bash
echo "const x: any = 1; console.log(x);" | bunx biome check --stdin-file-path=test.ts
```
Expected: Errors for `noExplicitAny` and `noConsoleLog`

- [ ] **Step 4: Verify all scripts work**

```bash
cd /Users/me/Developer/ctrl.page
bun run lint      # biome + grit
bun run fmt       # biome format
bun run check     # typecheck
bun run build     # full build still works
```
Expected: All pass

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: complete code quality stack setup"
```
