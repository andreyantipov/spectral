---
generated: true
---
# diag.ping

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
    UI->>EventBus: dispatch("diag.ping")
    EventBus->>BrowsingService: command
    BrowsingService->>Feature: handle
    Feature-->>EventBus: state.snapshot
```
