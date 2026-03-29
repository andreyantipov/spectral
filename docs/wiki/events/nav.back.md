---
generated: true
---
# nav.back

**Group:** navigation
**Primary Key:** `(p) => p.id`
**Response:** Session

## Payload

| Field | Type |
|-------|------|
| id | String |

## Flow

```mermaid
sequenceDiagram
    UI->>EventBus: dispatch("nav.back")
    EventBus->>BrowsingService: command
    BrowsingService->>Feature: handle
    Feature-->>EventBus: state.snapshot
```
