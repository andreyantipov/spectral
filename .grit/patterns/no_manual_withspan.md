---
title: No manual Effect.withSpan — use withTracing
level: error
tags: [quality, architecture]
---

# No manual Effect.withSpan — use withTracing

In `packages/libs/`, use the `withTracing()` wrapper instead of calling `Effect.withSpan()` directly.

```grit
language js

`Effect.withSpan($args)` where {
  $filename <: includes "packages/libs/"
}
```
