---
title: No raw async/await in Effect bun layer
level: error
tags: [quality, effect]
---

# No raw async/await in bun layer

Files in `src/bun/` use the Effect library for error handling. Use `Effect.gen` instead of raw `async/await` to keep error handling consistent.

```grit
language js

`async function $name($args) { $body }` where {
  $filename <: includes "src/bun/"
}
```
