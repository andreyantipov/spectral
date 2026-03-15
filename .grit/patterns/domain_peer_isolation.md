---
title: Domain peer isolation
level: error
tags: [architecture, hexagonal]
---

# Domain peer isolation

Sibling packages within the same layer cannot import each other:
- `domain.feature.*` cannot import other `domain.feature.*`
- `domain.adapter.*` cannot import other `domain.adapter.*`
- `ui.feature.*` cannot import other `ui.feature.*`

Note: `domain.service.*` peer isolation is covered by `domain_boundary_rules`.
Note: `ui.scenes` is a single package (not per-page packages), so no peer isolation rule is needed.

```grit
language js

`import $_ from $path` where {
  or {
    // domain.feature.* cannot import other domain.feature.*
    and {
      $filename <: includes "packages/libs/domain.feature.",
      $path <: includes "domain.feature."
    },
    // domain.adapter.* cannot import other domain.adapter.*
    and {
      $filename <: includes "packages/libs/domain.adapter.",
      $path <: includes "domain.adapter."
    },
    // ui.feature.* cannot import other ui.feature.*
    and {
      $filename <: includes "packages/libs/ui.feature.",
      $path <: includes "ui.feature."
    }
  }
}
```
