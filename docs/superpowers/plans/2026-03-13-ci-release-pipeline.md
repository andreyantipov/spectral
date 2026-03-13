# CI/CD & Release Pipeline Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automated PR checks via Dagger and automatic releases on merge to main via semantic-release, with repo policy managed by Probot Settings.

**Architecture:** Dagger TypeScript module at `packages/infra/ci/` exposes lint/typecheck/build functions. GitHub Actions workflows call Dagger on PRs and run semantic-release on merge to main. PR titles are auto-prefixed from `change:*` labels for conventional commits. Probot Settings enforces branch protection and merge rules.

**Tech Stack:** Dagger (TypeScript SDK), GitHub Actions, semantic-release, Probot Settings

---

## Chunk 1: Dagger CI Module

### Task 1: Initialize Dagger module

**Files:**
- Create: `packages/infra/ci/package.json`
- Create: `packages/infra/ci/tsconfig.json`
- Create: `packages/infra/ci/dagger.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@ctrl/ci",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "develop": "dagger develop",
    "validate": "dagger develop && dagger functions"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "experimentalDecorators": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "paths": {
      "@dagger.io/dagger": ["./sdk/index.ts"],
      "@dagger.io/dagger/telemetry": ["./sdk/telemetry.ts"]
    }
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create dagger.json**

```json
{
  "name": "ci",
  "engineVersion": "v0.19.8",
  "sdk": {
    "source": "typescript"
  },
  "dependencies": [],
  "disableDefaultFunctionCaching": true
}
```

- [ ] **Step 4: Initialize Dagger SDK**

Run:
```bash
cd /Users/me/Developer/ctrl.page/packages/infra/ci && dagger develop
```
Expected: Creates `sdk/` directory with Dagger TypeScript SDK files.

- [ ] **Step 5: Verify with dagger functions**

Run:
```bash
cd /Users/me/Developer/ctrl.page/packages/infra/ci && dagger functions
```
Expected: Empty list (no functions defined yet)

- [ ] **Step 6: Add sdk/ to .gitignore**

Add to `/Users/me/Developer/ctrl.page/.gitignore`:
```
packages/infra/ci/sdk
```

- [ ] **Step 7: Commit**

```bash
git add packages/infra/ci/ .gitignore
git commit -m "chore: initialize dagger ci module"
```

### Task 2: Create base container helper

**Files:**
- Create: `packages/infra/ci/src/lib/base.ts`

- [ ] **Step 1: Create base.ts**

```typescript
import { type Container, type Directory, dag } from "@dagger.io/dagger"

/**
 * Create base CI container with Bun runtime
 * Installs all dependencies from root package.json
 */
export async function baseContainer(source: Directory): Promise<Container> {
	return dag
		.container()
		.from("oven/bun:latest")
		.withDirectory("/app", source)
		.withWorkdir("/app")
		.withExec(["bun", "install", "--frozen-lockfile"])
}

/**
 * Run a command in the base container
 */
export function run(container: Container, args: string[]): Container {
	return container.withExec(args)
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/infra/ci/src/lib/base.ts
git commit -m "chore: add dagger base container helper"
```

### Task 3: Create lint and typecheck workflows

**Files:**
- Create: `packages/infra/ci/src/workflows/lint.ts`

- [ ] **Step 1: Create lint.ts**

```typescript
import type { Directory } from "@dagger.io/dagger"

import { baseContainer, run } from "../lib/base"

/**
 * Run all linting checks (Biome + GritQL)
 */
export async function lint(source: Directory): Promise<string> {
	const container = await baseContainer(source)

	await run(container, ["bun", "run", "lint"]).sync()

	return "Lint passed"
}

/**
 * Run TypeScript type checking via Turbo
 */
export async function typecheck(source: Directory): Promise<string> {
	const container = await baseContainer(source)

	await run(container, ["bun", "run", "check"]).sync()

	return "Typecheck passed"
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/infra/ci/src/workflows/lint.ts
git commit -m "chore: add dagger lint and typecheck workflows"
```

### Task 4: Create build workflow

**Files:**
- Create: `packages/infra/ci/src/workflows/build.ts`

- [ ] **Step 1: Create build.ts**

```typescript
import type { Directory } from "@dagger.io/dagger"

import { baseContainer, run } from "../lib/base"

/**
 * Run full build via Turbo (excludes desktop electrobun package)
 */
export async function build(source: Directory): Promise<string> {
	const container = await baseContainer(source)

	await run(container, [
		"bunx", "turbo", "build", "--filter=!@ctrl/desktop",
	]).sync()

	return "Build passed"
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/infra/ci/src/workflows/build.ts
git commit -m "chore: add dagger build workflow"
```

### Task 5: Create Dagger entry point

**Files:**
- Create: `packages/infra/ci/src/index.ts`

- [ ] **Step 1: Create index.ts**

```typescript
import { Directory, func, object } from "@dagger.io/dagger"

import { lint, typecheck } from "./workflows/lint"
import { build } from "./workflows/build"

@object()
// biome-ignore lint/correctness/noUnusedVariables: Exported via Dagger @object() decorator
class Ci {
	@func()
	async lint(source: Directory): Promise<string> {
		return lint(source)
	}

	@func()
	async typecheck(source: Directory): Promise<string> {
		return typecheck(source)
	}

	@func()
	async build(source: Directory): Promise<string> {
		return build(source)
	}
}
```

- [ ] **Step 2: Regenerate SDK and verify functions**

Run:
```bash
cd /Users/me/Developer/ctrl.page/packages/infra/ci && dagger develop && dagger functions
```
Expected: Shows `lint`, `typecheck`, `build` functions

- [ ] **Step 3: Test lint locally**

Run:
```bash
cd /Users/me/Developer/ctrl.page/packages/infra/ci && dagger call lint --source=../../..
```
Expected: "Lint passed"

- [ ] **Step 4: Test typecheck locally**

Run:
```bash
cd /Users/me/Developer/ctrl.page/packages/infra/ci && dagger call typecheck --source=../../..
```
Expected: "Typecheck passed"

- [ ] **Step 5: Commit**

```bash
git add packages/infra/ci/src/index.ts
git commit -m "chore: add dagger ci entry point with lint, typecheck, build"
```

---

## Chunk 2: GitHub Actions Workflows

### Task 6: Create CI workflow for PRs

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create ci.yml**

```yaml
name: CI

on:
  pull_request:
    types: [opened, synchronize, reopened]
  workflow_dispatch:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dagger/dagger-for-github@v7
        with:
          version: "latest"
          verb: call
          module: packages/infra/ci
          args: lint --source=.

  typecheck:
    name: Typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dagger/dagger-for-github@v7
        with:
          version: "latest"
          verb: call
          module: packages/infra/ci
          args: typecheck --source=.

  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dagger/dagger-for-github@v7
        with:
          version: "latest"
          verb: call
          module: packages/infra/ci
          args: build --source=.
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add PR checks workflow (lint, typecheck, build via Dagger)"
```

### Task 7: Create PR title enforcement workflow

**Files:**
- Create: `.github/workflows/pr-title.yml`

- [ ] **Step 1: Create pr-title.yml**

Adapted from qa-agent's `pr-title.yml`:

```yaml
name: PR Title

on:
  pull_request:
    types: [labeled, unlabeled, opened, edited, synchronize]

jobs:
  format:
    runs-on: ubuntu-latest
    if: ${{ !startsWith(github.event.pull_request.title, 'chore(release):') }}
    permissions:
      pull-requests: write
    env:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      PR_URL: ${{ github.event.pull_request.html_url }}
    steps:
      - name: Remove duplicate change labels
        if: github.event.action == 'labeled' && startsWith(github.event.label.name, 'change:')
        run: |
          LABELS=$(gh pr view "$PR_URL" --json labels --jq '.labels[].name | select(startswith("change:"))')
          JUST_ADDED="${{ github.event.label.name }}"
          for LABEL in $LABELS; do
            if [ "$LABEL" != "$JUST_ADDED" ]; then
              gh pr edit "$PR_URL" --remove-label "$LABEL"
              echo "Removed duplicate label: $LABEL"
            fi
          done

      - name: Validate and update PR title
        run: |
          PR_DATA=$(gh pr view "$PR_URL" --json labels,title)
          LABELS=$(echo "$PR_DATA" | jq -r '.labels[].name')
          TITLE=$(echo "$PR_DATA" | jq -r '.title')

          HAS_CHANGE=$(echo "$LABELS" | grep -q "^change:" && echo "yes" || echo "no")

          if [ "$HAS_CHANGE" = "no" ]; then
            echo "::error::Missing required label. Add one of: change:fix, change:feat, change:breaking, or change:chore"
            exit 1
          fi

          PREFIX="fix"
          if echo "$LABELS" | grep -q "change:breaking"; then
            PREFIX="feat!"
          elif echo "$LABELS" | grep -q "change:feat"; then
            PREFIX="feat"
          elif echo "$LABELS" | grep -q "change:fix"; then
            PREFIX="fix"
          elif echo "$LABELS" | grep -q "change:chore"; then
            PREFIX="chore"
          fi

          CLEAN_TITLE=$(echo "$TITLE" | sed -E 's/^(feat!?|fix|chore|docs|refactor|test|ci)(\([^)]+\))?:\s*//')
          NEW_TITLE="$PREFIX: $CLEAN_TITLE"

          if [ "$NEW_TITLE" != "$TITLE" ]; then
            gh pr edit "$PR_URL" --title "$NEW_TITLE"
            echo "Updated title to: $NEW_TITLE"
          else
            echo "Title already correct: $TITLE"
          fi

          FINAL_TITLE=$(gh pr view "$PR_URL" --json title --jq '.title')
          if ! echo "$FINAL_TITLE" | grep -qE "^(feat!?|fix|chore|docs|refactor|test|ci)(\([^)]+\))?:\s*.+"; then
            echo "::error::Invalid PR title format. Must be: type: description"
            exit 1
          fi

          echo "PR title valid: $FINAL_TITLE"
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/pr-title.yml
git commit -m "ci: add PR title enforcement from change labels"
```

### Task 8: Create release workflow

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create release.yml**

```yaml
name: Release

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: release
  cancel-in-progress: false

permissions:
  contents: write
  issues: write
  pull-requests: write

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dagger/dagger-for-github@v7
        with:
          version: "latest"
          verb: call
          module: packages/infra/ci
          args: lint --source=.

  typecheck:
    name: Typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dagger/dagger-for-github@v7
        with:
          version: "latest"
          verb: call
          module: packages/infra/ci
          args: typecheck --source=.

  release:
    name: Release
    needs: [lint, typecheck]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          persist-credentials: false

      - uses: oven-sh/setup-bun@v2

      - name: Install dependencies
        run: bun install

      - name: Run semantic-release
        run: bunx semantic-release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add release workflow with semantic-release"
```

---

## Chunk 3: semantic-release & Probot Settings

### Task 9: Configure semantic-release

**Files:**
- Create: `/Users/me/Developer/ctrl.page/.releaserc.json`
- Modify: `/Users/me/Developer/ctrl.page/package.json`

- [ ] **Step 1: Install semantic-release plugins**

Run:
```bash
cd /Users/me/Developer/ctrl.page && bun add -d semantic-release @semantic-release/changelog @semantic-release/git
```

- [ ] **Step 2: Create .releaserc.json**

```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    ["@semantic-release/changelog", {
      "changelogFile": "CHANGELOG.md"
    }],
    ["@semantic-release/npm", {
      "npmPublish": false
    }],
    ["@semantic-release/git", {
      "assets": ["CHANGELOG.md", "package.json"],
      "message": "chore(release): ${nextRelease.version}\n\n${nextRelease.notes}"
    }],
    "@semantic-release/github"
  ]
}
```

- [ ] **Step 3: Verify semantic-release config**

Run:
```bash
cd /Users/me/Developer/ctrl.page && bunx semantic-release --dry-run --no-ci
```
Expected: Shows what version would be released (or "no release" if no conventional commits)

- [ ] **Step 4: Commit**

```bash
git add .releaserc.json package.json
git commit -m "chore: configure semantic-release"
```

### Task 10: Create Probot Settings config

**Files:**
- Create: `.github/settings.yml`

- [ ] **Step 1: Create settings.yml**

```yaml
repository:
  default_branch: main
  allow_squash_merge: true
  allow_merge_commit: false
  allow_rebase_merge: false
  delete_branch_on_merge: true

labels:
  - name: "change:fix"
    color: "d73a4a"
    description: "Bug fix (patch version bump)"
  - name: "change:feat"
    color: "0075ca"
    description: "New feature (minor version bump)"
  - name: "change:breaking"
    color: "e11d48"
    description: "Breaking change (major version bump)"
  - name: "change:chore"
    color: "6b7280"
    description: "Maintenance (no version bump)"

branches:
  - name: main
    protection:
      required_status_checks:
        strict: true
        contexts:
          - "Lint"
          - "Typecheck"
          - "Build"
      required_pull_request_reviews: null
      enforce_admins: false
      restrictions: null
```

- [ ] **Step 2: Commit**

```bash
git add .github/settings.yml
git commit -m "ci: add probot settings for repo policy"
```

### Task 11: Install Probot Settings GitHub App

- [ ] **Step 1: Install the Settings app on the repo**

Go to https://github.com/apps/settings and install it on the `andreyantipov/ctrl.page` repository. This enables the `.github/settings.yml` to be applied automatically.

### Task 12: Final verification

- [ ] **Step 1: Verify Dagger functions work**

Run:
```bash
cd /Users/me/Developer/ctrl.page/packages/infra/ci && dagger functions
```
Expected: Shows `lint`, `typecheck`, `build`

- [ ] **Step 2: Verify local Dagger lint**

Run:
```bash
cd /Users/me/Developer/ctrl.page/packages/infra/ci && dagger call lint --source=../../..
```
Expected: "Lint passed"

- [ ] **Step 3: Verify all workflow files exist**

```bash
ls -la /Users/me/Developer/ctrl.page/.github/workflows/
```
Expected: `ci.yml`, `pr-title.yml`, `release.yml`

```bash
ls -la /Users/me/Developer/ctrl.page/.github/settings.yml
```
Expected: File exists

- [ ] **Step 4: Verify .releaserc.json exists**

```bash
cat /Users/me/Developer/ctrl.page/.releaserc.json | head -5
```
Expected: Shows semantic-release config

- [ ] **Step 5: Final commit if any changes**

```bash
git add -A && git status
```
If clean: done. If changes: commit with appropriate message.

---

## Verification

After pushing to GitHub:
1. Create a PR — `ci.yml` should trigger lint/typecheck/build checks
2. Add a `change:feat` label — `pr-title.yml` should auto-prefix title
3. Merge PR to main — `release.yml` should create a GitHub release with version bump
