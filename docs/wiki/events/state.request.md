---
generated: true
---
# state.request

**Group:** system
**Primary Key:** `() => "global"`
**Response:** void

## Payload

| Field | Type |
|-------|------|
| — | — |

## Flow

```mermaid
sequenceDiagram
    UI->>EventBus: dispatch("state.request")
    EventBus->>BrowsingService: command
    BrowsingService->>Feature: handle
    Feature-->>EventBus: state.snapshot
```
