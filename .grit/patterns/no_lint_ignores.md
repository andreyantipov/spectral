---
title: No lint ignore comments
level: error
tags: [quality]
---

# No lint ignore comments

Lint ignore comments are prohibited in `packages/`. Fix the underlying issue instead of suppressing it.

```grit
language js

or {
  `// biome-ignore $rest` where { $filename <: includes "packages/" },
  `// eslint-disable $rest` where { $filename <: includes "packages/" },
  `// @ts-ignore` where { $filename <: includes "packages/" },
  `// @ts-nocheck` where { $filename <: includes "packages/" },
  `// @ts-expect-error $rest` where { $filename <: includes "packages/" }
}
```
