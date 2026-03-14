---
title: No interface in packages/libs — use type
level: error
tags: [quality, architecture]
---

# No interface in packages/libs — use type

All type declarations in `packages/libs/` must use `type` instead of `interface` for consistency.

```grit
language js

`interface $name { $body }` where {
  $filename <: includes "packages/libs/"
}
```
