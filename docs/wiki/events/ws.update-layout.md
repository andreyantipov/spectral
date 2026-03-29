---
generated: true
---
# ws.update-layout

**Group:** workspace
**Primary Key:** `() => "global"`
**Response:** void

## Payload

| Field | Type |
|-------|------|
| layout | Struct |
| version | Number |
| dockviewState | Unknown |

## Flow

```mermaid
sequenceDiagram
    UI->>EventBus: dispatch("ws.update-layout")
    EventBus->>BrowsingService: command
    BrowsingService->>Feature: handle
    Feature-->>EventBus: state.snapshot
```
