---
generated: true
---
# nav.navigate

**Group:** navigation
**Primary Key:** `(p) => p.id`
**Response:** Session

## Payload

| Field | Type |
|-------|------|
| id | String |
| input | String |

## Flow

```mermaid
sequenceDiagram
    UI->>EventBus: dispatch("nav.navigate")
    EventBus->>BrowsingService: command
    BrowsingService->>Feature: handle
    Feature-->>EventBus: state.snapshot
```
