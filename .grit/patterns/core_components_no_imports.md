---
title: core.ui.components cannot import domain, api, or port packages
level: error
tags: [architecture, boundary]
---

# core.ui.components boundary

core.ui.components is a pure presentational package. It cannot import from domain.*, core.ui.api, or core.port.*.

```grit
language js

`import $_ from $path` where {
  $filename <: includes "packages/libs/core.ui.components",
  $path <: or {
    includes "domain.",
    includes "core.ui.api",
    includes "core.port."
  }
}
```
