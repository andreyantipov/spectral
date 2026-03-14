---
title: No cva in core.ui — use sva only
level: error
tags: [quality, core-ui]
---

# No cva in core.ui — use sva only

All component styles in core.ui must use `sva` (slot variant API), never `cva`.

```grit
language js

`cva($args)` where {
  $filename <: includes "packages/libs/core.ui/"
}
```
