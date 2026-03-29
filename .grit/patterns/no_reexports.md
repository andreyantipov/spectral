---
title: No re-exports from other packages
level: error
tags: [architecture, quality]
---

Barrel index.ts files must only export from within their own package (relative paths). Never re-export from other @ctrl/* packages.

```grit
language js

or {
  `export { $_ } from $path` where {
    $path <: includes "@ctrl/",
    $filename <: includes "index.ts"
  },
  `export * from $path` where {
    $path <: includes "@ctrl/",
    $filename <: includes "index.ts"
  }
}
```
