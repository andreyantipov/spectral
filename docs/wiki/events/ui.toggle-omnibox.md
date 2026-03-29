---
generated: true
---
# ui.toggle-omnibox

**Group:** ui
**Primary Key:** `() => "global"`
**Response:** void

## Payload

| Field | Type |
|-------|------|
| — | — |

## Flow

```mermaid
sequenceDiagram
    UI->>EventBus: dispatch("ui.toggle-omnibox")
    EventBus->>BrowsingService: command
    BrowsingService->>Feature: handle
    Feature-->>EventBus: state.snapshot
```
