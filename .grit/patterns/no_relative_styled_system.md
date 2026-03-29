---
title: No relative styled-system imports — use @styled-system alias
level: error
tags: [quality, architecture]
---

# No relative styled-system imports

Use `@styled-system/*` path alias instead of relative paths to `styled-system/`. The alias is defined in the root `tsconfig.json` and resolves to `packages/libs/core.ui.design/styled-system/*`.

```grit
language js

`from "$path"` where {
  $path <: includes "styled-system/",
  $path <: includes "../",
  $filename <: includes "packages/"
}
```
