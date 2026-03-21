---
title: Domain layers must use withTracing
level: error
tags: [quality, architecture, observability]
---

# Domain layers must use withTracing

All `Layer.succeed` and `Layer.effect` calls in `domain.adapter.*`, `domain.feature.*`, and `domain.service.*` packages must wrap their service implementation with `withTracing()`. This ensures every domain operation produces OTEL spans automatically.

Allowed patterns:
- `withTracing(CONSTANT, { ... })` — direct wrapping
- `makeFeatureService(...)` — factory that applies `withTracing()` internally
- `makeRepository(...)` — factory that applies `withTracing()` internally

```grit
language js

or {
  `Layer.succeed($tag, { $props })`,
  `Layer.succeed($tag, $obj)` where {
    $obj <: not contains `withTracing($_, $_)`
  }
} where {
  $filename <: includes "packages/libs/domain.",
  $filename <: not includes ".test.",
  $filename <: not includes "test-utils"
}
```
