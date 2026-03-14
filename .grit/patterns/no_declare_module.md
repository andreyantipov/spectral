---
title: No declare module in application code
level: error
tags: [quality, architecture]
---

# No declare module in application code

`declare module` augmentations are prohibited in `packages/libs/` and `packages/apps/`. Use utility functions or proper type exports instead.

```grit
language js

`declare module $_ { $_ }` where {
  $filename <: or { includes "packages/libs/", includes "packages/apps/" }
}
```
