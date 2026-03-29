---
title: No hardcoded event tags in Sets
level: error
tags: [quality, api-consistency]
---

# No hardcoded event tags

Event tag strings must come from `EventGroup.events[tag].tag`, not written directly.

```grit
language js

`new Set([$args])` where {
    $args <: contains or { `"session.$_"`, `"nav.$_"`, `"bm.$_"`, `"ws.$_"`, `"state.$_"`, `"diag.$_"`, `"ui.$_"` },
    $filename <: not includes "groups/"
}
```
