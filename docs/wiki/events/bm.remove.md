---
generated: true
---
# bm.remove

**Group:** bookmark
**Primary Key:** `(p) => p.id`
**Response:** void

## Payload

| Field | Type |
|-------|------|
| id | String |

## Flow

```mermaid
sequenceDiagram
    UI->>EventBus: dispatch("bm.remove")
    EventBus->>BrowsingService: command
    BrowsingService->>Feature: handle
    Feature-->>EventBus: state.snapshot
```
