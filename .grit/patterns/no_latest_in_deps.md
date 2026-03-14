---
title: No "latest" version strings in package.json
level: error
---

# No "latest" in dependency versions

Dependency versions in `package.json` must be pinned to actual semver ranges. Using `"latest"` makes builds non-reproducible.

```grit
language json

`"latest"` => . where {
    $filename <: includes "package.json"
}
```

## Expected

```json
{
  "dependencies": {
    "effect": "^3.19.19"
  }
}
```

## Unexpected

```json
{
  "dependencies": {
    "effect": "latest"
  }
}
```
