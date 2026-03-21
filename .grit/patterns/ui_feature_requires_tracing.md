---
title: UI features must use withWebTracing for business logic
level: error
tags: [quality, architecture, observability]
---

# UI features must use withWebTracing

All `ui.feature.*` packages must import `withWebTracing` from `@ctrl/core.shared` to instrument their business logic operations. This ensures frontend-to-backend trace chains are complete.

```grit
language js

file($body) where {
  $filename <: includes "packages/libs/ui.feature.",
  $filename <: includes "/ui/",
  $filename <: or { includes ".tsx", includes ".ts" },
  $filename <: not includes ".test.",
  $body <: contains `runtime.runPromise($args)`,
  $body <: not contains `withWebTracing`
}
```
