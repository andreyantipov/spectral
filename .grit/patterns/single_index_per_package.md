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
