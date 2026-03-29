---
title: core.ui.components must not import domain logic or API
level: error
tags: [architecture, boundary]
---

# core.ui.components must not import domain logic or API

`core.ui.components` is a pure UI component package. It must not import from domain packages, core.ui.api, or port packages.

```grit
language js

`import $_ from $path` where {
  $filename <: includes "packages/libs/core.ui.components",
  $path <: or { includes "domain.", includes "core.ui.api", includes "core.port." }
}
```
