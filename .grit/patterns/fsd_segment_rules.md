---
title: FSD segment rules
level: error
tags: [architecture, fsd]
---

# FSD segment rules

Enforces Feature-Sliced Design segment conventions:
- `model/` never imports from `api/` — models are dependencies, not dependents
- `lib/` must be pure — no `yield*` (use `api/` for Effect service code)

```grit
language js

or {
  // model/ must not import from api/
  `import $_ from $path` where {
    $filename <: includes "/model/",
    $path <: includes "/api/"
  },
  // lib/ must be pure — no yield* (use api/ for Effect service code)
  `yield* $expr` where {
    $filename <: includes "/lib/"
  }
}
```
