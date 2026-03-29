---
generated: true
---
# session.close

**Group:** session
**Primary Key:** `(p) => p.id`
**Response:** void

## Payload

| Field | Type |
|-------|------|
| id | String |

## Flow

```mermaid
sequenceDiagram
    UI->>EventBus: dispatch("session.close")
    EventBus->>BrowsingService: command
    BrowsingService->>Feature: handle
    Feature-->>EventBus: state.snapshot
```
