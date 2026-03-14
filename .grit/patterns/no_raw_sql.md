---
title: No raw SQL outside domain.adapter.db
level: error
tags: [architecture]
---

# No raw SQL outside domain.adapter.db

All database operations must go through `domain.adapter.db`. Raw SQL template literals containing DDL/DML keywords are prohibited elsewhere.

```grit
language js

`$tag$fragment` where {
  $fragment <: or {
    contains "CREATE ",
    contains "SELECT ",
    contains "INSERT ",
    contains "UPDATE ",
    contains "DELETE ",
    contains "ALTER ",
    contains "DROP "
  },
  $filename <: not includes "domain.adapter.db",
  $filename <: not includes "core.db"
}
```
