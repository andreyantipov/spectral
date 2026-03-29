---
generated: true
---
# ws.move-panel

**Group:** workspace
**Primary Key:** `(p) => p.panelId`
**Response:** void

## Payload

| Field | Type |
|-------|------|
| panelId | String |
| targetGroupId | String |

## Flow

```mermaid
sequenceDiagram
    UI->>EventBus: dispatch("ws.move-panel")
    EventBus->>BrowsingService: command
    BrowsingService->>Feature: handle
    Feature-->>EventBus: state.snapshot
```
