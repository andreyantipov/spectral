---
generated: true
---
# ws.split-panel

**Group:** workspace
**Primary Key:** `(p) => p.panelId`
**Response:** void

## Payload

| Field | Type |
|-------|------|
| panelId | String |
| direction | Literal |
| newPanel | PanelRefSchema |

## Flow

```mermaid
sequenceDiagram
    UI->>EventBus: dispatch("ws.split-panel")
    EventBus->>BrowsingService: command
    BrowsingService->>Feature: handle
    Feature-->>EventBus: state.snapshot
```
