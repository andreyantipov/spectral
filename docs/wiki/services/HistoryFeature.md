---
generated: true
---
# HistoryFeature

**Package:** `@ctrl/domain.feature.history`
**Tier:** domain.feature
**Tag ID:** HISTORY_FEATURE
**Provided by:** HistoryFeatureLive

## Methods

- `getAll`
- `record`
- `clear`
- `changes`

## Dependencies

- [[HistoryRepository]]

## Layer Graph

```mermaid
graph LR
    HistoryFeatureLive -->|provides| HistoryFeature
    HistoryFeature -->|requires| HistoryRepository
```
