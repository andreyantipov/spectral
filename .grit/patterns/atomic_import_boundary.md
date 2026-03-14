---
title: Atomic design import boundary
level: error
tags: [quality, core-ui, architecture]
---

# Atomic design import boundary

Enforces one-way import dependencies in core.ui:
- atoms cannot import from molecules, organisms, or templates
- molecules cannot import from organisms or templates
- organisms cannot import from templates

```grit
language js

`import $_ from $path` where {
  $filename <: includes "packages/libs/core.ui/",
  or {
    and {
      $filename <: includes "/atoms/",
      $path <: or { includes "molecules", includes "organisms", includes "templates" }
    },
    and {
      $filename <: includes "/molecules/",
      $path <: or { includes "organisms", includes "templates" }
    },
    and {
      $filename <: includes "/organisms/",
      $path <: includes "templates"
    }
  }
}
```
