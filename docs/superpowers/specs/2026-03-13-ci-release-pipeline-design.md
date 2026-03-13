# CI/CD & Release Pipeline Design

## Goal

Automated quality checks on PRs and automatic releases on merge to main, using Dagger for CI logic, GitHub Actions as trigger layer, semantic-release for versioning, and Probot Settings for repo policy.

## Principle

If all checks pass on merge to main, a release happens. No manual gates.

## Architecture

### Components

1. **Probot Settings** — `.github/settings.yml` for repo policy (branch protection, labels, merge rules)
2. **Dagger TypeScript module** — `packages/infra/ci/` with lint, typecheck, build functions
3. **GitHub Actions workflows** — trigger layer calling Dagger + managing releases
4. **semantic-release** — conventional commit version bumps + changelog + GitHub releases
5. **PR title enforcement** — `change:*` labels auto-prefix PR titles with conventional commit types

### PR Flow

1. Developer opens PR
2. `pr-title.yml` checks for `change:*` label, auto-prefixes title (`fix:`, `feat:`, `feat!:`, `chore:`)
3. `ci.yml` runs Dagger checks: lint, typecheck, build
4. Branch protection (Probot) requires all checks to pass
5. Squash merge only (PR title becomes commit message)

### Release Flow

1. PR merged to main (squash merge — PR title is the conventional commit)
2. `release.yml` triggers
3. Dagger lint runs as quality gate
4. semantic-release analyzes commits since last tag
5. If releasable commits found: bump version, update CHANGELOG.md, create git tag, create GitHub release
6. Version bump + changelog committed back to main

## Dagger Module

Base container: `oven/bun:latest`

### File Structure

```
packages/infra/ci/
  src/
    index.ts          # Dagger @object() class exposing functions
    lib/
      base.ts         # baseContainer(), run() helpers
    workflows/
      lint.ts         # lint(), typecheck()
      build.ts        # build()
  package.json
  tsconfig.json
  dagger.json
```

### Functions

- `lint(source: Directory)` — runs `biome check . && bunx grit check .`
- `typecheck(source: Directory)` — runs `turbo check`
- `build(source: Directory)` — runs `turbo build` (excluding desktop electrobun build)

### Base Container

```typescript
dag.container()
  .from("oven/bun:latest")
  .withDirectory("/app", source)
  .withWorkdir("/app")
  .withExec(["bun", "install"])
```

Turbo and other dev tools are installed via `bun install` from root devDependencies.

## GitHub Actions

### `.github/workflows/ci.yml`

Triggers on PR (opened, synchronize, reopened). Runs three parallel jobs via Dagger:

```yaml
jobs:
  lint:
    steps:
      - uses: actions/checkout@v4
      - uses: dagger/dagger-for-github@v7
        with:
          verb: call
          module: packages/infra/ci
          args: lint --source=.

  typecheck:
    steps:
      - uses: actions/checkout@v4
      - uses: dagger/dagger-for-github@v7
        with:
          verb: call
          module: packages/infra/ci
          args: typecheck --source=.

  build:
    steps:
      - uses: actions/checkout@v4
      - uses: dagger/dagger-for-github@v7
        with:
          verb: call
          module: packages/infra/ci
          args: build --source=.
```

### `.github/workflows/pr-title.yml`

Triggers on PR label/title changes. Logic (adapted from qa-agent):

1. Require exactly one `change:*` label
2. Map label to conventional commit prefix:
   - `change:fix` → `fix:`
   - `change:feat` → `feat:`
   - `change:breaking` → `feat!:`
   - `change:chore` → `chore:`
3. Auto-update PR title with correct prefix
4. Fail if no `change:*` label present

### `.github/workflows/release.yml`

Triggers on push to main. Flow:

1. Run Dagger lint as quality gate
2. Run semantic-release
3. semantic-release handles: version bump, CHANGELOG.md, git tag, GitHub release

```yaml
on:
  push:
    branches: [main]

jobs:
  lint:
    # Dagger lint check

  release:
    needs: [lint]
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          persist-credentials: false
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bunx semantic-release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Probot Settings

```yaml
# .github/settings.yml
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
        contexts: ["Lint", "Typecheck", "Build"]
      required_pull_request_reviews: null
      enforce_admins: false
```

## semantic-release Config

Root `.releaserc.json`:

```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    ["@semantic-release/changelog", { "changelogFile": "CHANGELOG.md" }],
    ["@semantic-release/npm", { "npmPublish": false }],
    ["@semantic-release/git", {
      "assets": ["CHANGELOG.md", "package.json"],
      "message": "chore(release): ${nextRelease.version}\n\n${nextRelease.notes}"
    }],
    "@semantic-release/github"
  ]
}
```

## Dependencies

Added to root devDependencies:
- `semantic-release`
- `@semantic-release/changelog`
- `@semantic-release/git`

Added to `packages/infra/ci/`:
- `@dagger.io/dagger`

## Prerequisites

- Install the Probot Settings GitHub App on the repo
- GitHub Actions enabled on the repo
- `GITHUB_TOKEN` available in Actions (default)

