---
generated: true
---
# nav.update-title

**Group:** navigation
**Primary Key:** `(p) => p.id`
**Response:** void

## Payload

| Field | Type |
|-------|------|
| id | String |
| title | String |

## Flow

```mermaid
sequenceDiagram
    UI->>EventBus: dispatch("nav.update-title")
    EventBus->>BrowsingService: command
    BrowsingService->>Feature: handle
    Feature-->>EventBus: state.snapshot
```
