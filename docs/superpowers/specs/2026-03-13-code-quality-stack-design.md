# Code Quality Stack Design

## Goal

Catch bugs early and enforce code consistency across the ctrl.page monorepo using Biome (formatting + standard linting), GritQL (custom structural rules), and Lefthook (pre-commit gate).

## Architecture

Two lint layers run via Turbo scripts and are gated by a pre-commit hook:

```
lefthook pre-commit
  ├── biome check --staged    (format + standard lint)
  ├── grit check              (custom structural rules)
  └── turbo check             (TypeScript type checking)
```

## Layer 1: Biome

Single `biome.json` at repo root. Applies to all packages.

### Formatting

- Targets: `*.ts`, `*.tsx`, `*.json`
- Style: tabs for indentation, double quotes, trailing commas
- Ignores: `node_modules`, `dist`, `build`, `styled-system`, `.turbo`

### Lint Rules

Biome's recommended ruleset, plus:

- `noExplicitAny` — error
- `noUnusedVariables` — error
- `noUnusedImports` — error
- `useConsistentArrayType` — prefer `T[]` over `Array<T>`
- `noConsole` — warn (GritQL handles the stricter version)

### Integration

```json
// biome.json (root)
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "organizeImports": { "enabled": true },
  "formatter": {
    "indentStyle": "tab",
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "files": {
    "ignore": ["node_modules", "dist", "build", "styled-system", ".turbo", "*.config.ts"]
  }
}
```

## Layer 2: GritQL

Custom structural rules in `.grit/` at repo root. Each rule is a `.grit` file.

### Rules

#### `no-any` — Ban `any` type annotations

Redundant with Biome's `noExplicitAny` but acts as a safety net and demonstrates GritQL patterns.

```grit
language js

`any` as $a where {
  $a <: within type_annotation(_)
} => .
```

#### `effect-no-raw-promises` — No raw async/await in bun layer

Files in `src/bun/` must use `Effect.gen` instead of raw `async/await`. Prevents mixing Effect and Promise-based error handling.

```grit
language js

// Match async function declarations in bun source files
`async function $name($args) { $body }` where {
  $filename <: includes "src/bun/"
}
```

#### `no-console-log` — No console.log in production code

`console.log` calls are banned. Use `console.error` or `console.warn` for legitimate output, or structured logging.

```grit
language js

`console.log($args)` => .
```

#### `solid-tsx-only` — JSX must be in .tsx files

Any file containing JSX syntax must have a `.tsx` extension. Prevents Solid.js components from being placed in `.ts` files.

```grit
language js

// Match JSX elements in non-tsx files
`<$tag $attrs>$children</$tag>` where {
  $filename <: not includes ".tsx"
}
```

#### `no-direct-node-modules-in-renderer` — Renderer imports through workspace

Files in `src/main-ui/` should not import directly from packages outside the workspace. All dependencies should flow through `@ctrl/*` workspace packages (except `electrobun/view` and `solid-js` which are direct renderer deps).

```grit
language js

`import $binding from $source` where {
  $filename <: includes "src/main-ui/",
  $source <: not includes "@ctrl/",
  $source <: not includes "electrobun",
  $source <: not includes "solid-js",
  $source <: not includes "./"
}
```

#### `single-index-per-package` — One index.ts per package

Each package under `packages/` must have exactly one `index.ts` as its public entry point. No nested `index.ts` files in subdirectories. This is enforced as a file-system check script rather than a GritQL pattern (GritQL operates on AST, not file structure).

Implementation: A small Bun script (`scripts/check-single-index.ts`) that:
1. Globs for all `index.ts` files under `packages/`
2. Groups by package
3. Errors if any package has more than one `index.ts`

## Layer 3: Lefthook (Pre-commit)

Lefthook config at repo root. Runs on staged files only for speed.

```yaml
# lefthook.yml
pre-commit:
  parallel: false
  commands:
    biome:
      glob: "*.{ts,tsx,json}"
      run: bunx biome check --staged --no-errors-on-unmatched
      stage_fixed: true
    grit:
      glob: "*.{ts,tsx}"
      run: bunx grit check {staged_files}
    typecheck:
      run: bun run check
```

`stage_fixed: true` on biome means auto-formatted files get re-staged automatically.

## Scripts

Added to root `package.json`:

```json
{
  "scripts": {
    "lint": "biome check . && grit check .",
    "lint:fix": "biome check --write .",
    "fmt": "biome format --write .",
    "check": "turbo check"
  }
}
```

Updated in `turbo.json`:

```json
{
  "lint": {
    "dependsOn": ["^build"]
  }
}
```

## File Structure

```
ctrl.page/
  biome.json                          # Biome config
  lefthook.yml                        # Pre-commit hooks
  .grit/
    gritmodules/                      # GritQL dependencies (gitignored)
    patterns/
      no_any.grit
      effect_no_raw_promises.grit
      no_console_log.grit
      solid_tsx_only.grit
      no_direct_node_modules.grit
  scripts/
    check-single-index.ts             # File-system rule for single index.ts
```

## Dependencies

Added to root `package.json` devDependencies:

- `@biomejs/biome` — formatting + linting
- `lefthook` — pre-commit hooks

GritQL is installed via `npx @getgrit/cli` (no package dependency needed, or optionally `@getgrit/cli` as devDependency for pinned version).

## Setup Steps

1. Install Biome and Lefthook as devDependencies
2. Create `biome.json` at repo root
3. Create `.grit/patterns/` with rule files
4. Create `lefthook.yml` at repo root
5. Run `lefthook install` to set up git hooks
6. Create `scripts/check-single-index.ts`
7. Update root `package.json` scripts
8. Run `biome check --write .` to format existing code
9. Verify all checks pass on current codebase

## What This Does Not Include

- Test framework (separate concern, future spec)
- CI/CD pipeline (explicitly excluded per requirements)
- Editor plugin configuration (Biome has Zed/VS Code support but left to individual preference)
