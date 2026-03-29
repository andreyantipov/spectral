---
title: No sva/cva/css declarations in .tsx files
level: error
tags: [quality, core-ui]
---

# No sva/cva/css declarations in .tsx files

Style declarations must live in `.style.ts` files, not in `.tsx` component files.

```grit
language js

or {
  `sva($args)`,
  `cva($args)`,
  `css($args)`
} where {
  $filename <: includes "packages/libs/core.ui.components/",
  $filename <: includes ".tsx"
}
```
