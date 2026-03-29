---
title: No re-exports from external packages in barrel files
level: error
tags: [architecture, imports]
---

# No re-exports

Barrel index.ts files in core.* and ui.* packages cannot re-export from @ctrl/* packages. Only relative exports are allowed. Domain service packages may re-export types from their features as part of their public API.

```grit
language js

or {
  `export { $_ } from $path`,
  `export type { $_ } from $path`,
  `export * from $path`
} where {
  $filename <: includes "index.ts",
  $path <: includes "@ctrl/",
  $filename <: or {
    includes "packages/libs/core.",
    includes "packages/libs/ui."
  }
}
```
