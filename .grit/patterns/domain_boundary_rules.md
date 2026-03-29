---
title: Domain boundary rules
level: error
tags: [architecture, hexagonal]
---

# Domain boundary rules

Enforces hexagonal architecture layer boundaries:
- `ui.*` can only import `domain.service.*` (not `domain.feature.*` or `domain.adapter.*`)
- `apps/*` can only import `ui.scene.*` (not `ui.feature.*`)
- `domain.feature.*` cannot import `domain.service.*` or `domain.adapter.*`
- `domain.service.*` cannot import `domain.adapter.*` or other `domain.service.*`
- `domain.adapter.*` cannot import `domain.feature.*` or `domain.service.*`
- `core.*` cannot import `domain.*` or `ui.*`

```grit
language js

`import $_ from $path` where {
  // Test files are exempt from boundary rules — they need cross-layer access for mocks and test utilities
  $filename <: not includes ".test.",
  or {
    // ui.* cannot import domain.feature.* or domain.adapter.*
    and {
      $filename <: includes "packages/libs/ui.",
      $path <: or { includes "domain.feature.", includes "domain.adapter." }
    },
    // apps/* can only import ui.scenes (not ui.feature.*)
    and {
      $filename <: includes "packages/apps/",
      $path <: includes "ui.feature."
    },
    // domain.feature.* cannot import domain.service.* or domain.adapter.*
    and {
      $filename <: includes "packages/libs/domain.feature.",
      $path <: or { includes "domain.service.", includes "domain.adapter." }
    },
    // domain.service.* cannot import domain.adapter.*
    and {
      $filename <: includes "packages/libs/domain.service.",
      $path <: includes "domain.adapter."
    },
    // domain.service.* cannot import other domain.service.*
    and {
      $filename <: includes "packages/libs/domain.service.",
      $path <: includes "domain.service."
    },
    // domain.adapter.* cannot import domain.feature.* or domain.service.*
    and {
      $filename <: includes "packages/libs/domain.adapter.",
      $path <: or { includes "domain.feature.", includes "domain.service." }
    },
    // core.* cannot import domain.* or ui.*
    and {
      $filename <: includes "packages/libs/core.",
      $path <: or { includes "domain.feature.", includes "domain.service.", includes "domain.adapter.", includes "ui.feature.", includes "ui.scene." }
    }
  }
}
```
