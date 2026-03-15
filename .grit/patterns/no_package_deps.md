---
title: No non-workspace dependencies in package-level package.json
level: error
tags: [quality, monorepo]
---

# No non-workspace dependencies in package-level package.json

All external dependencies must be declared in the root `package.json`. Libs packages may only have `workspace:*` dependencies (for turbo build ordering) — no external packages allowed. `devDependencies` are never allowed in libs packages.

```grit
language json

or {
  `"dependencies": { $deps }` where {
    $filename <: includes "packages/libs/",
    $deps <: not includes "workspace"
  },
  `"devDependencies": { $deps }` where {
    $filename <: includes "packages/libs/"
  },
  `"dependencies": { $deps }` where {
    $filename <: includes "packages/",
    $filename <: not includes "packages/libs/",
    $filename <: not includes "packages/infra/ci",
    $deps <: not includes "workspace"
  },
  `"devDependencies": { $deps }` where {
    $filename <: includes "packages/",
    $filename <: not includes "packages/libs/",
    $filename <: not includes "packages/infra/ci"
  }
}
```
