---
generated: true
---
# BookmarkFeature

**Package:** `@ctrl/domain.feature.bookmark`
**Tier:** domain.feature
**Tag ID:** BOOKMARK_FEATURE
**Provided by:** BookmarkFeatureLive

## Methods

- `getAll`
- `create`
- `remove`
- `isBookmarked`
- `changes`

## Dependencies

- [[BookmarkRepository]]

## Layer Graph

```mermaid
graph LR
    BookmarkFeatureLive -->|provides| BookmarkFeature
    BookmarkFeature -->|requires| BookmarkRepository
```
