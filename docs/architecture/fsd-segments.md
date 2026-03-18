# FSD Internal Segments

Every package uses Feature-Sliced Design segments internally. Four universal segment names apply to all packages regardless of hex layer.

## The Four Segments

| Segment | Purpose | Rule |
|---------|---------|------|
| `model/` | Types, state, events, schemas, validators, ports | **What this slice knows.** Never imports from `api/`. |
| `api/` | Service impl, repository impl, bindings | **What this slice does.** The capability layer. |
| `lib/` | Pure functions, factories, helpers, constants | **Reusable utilities.** No Effect services, no side effects. |
| `ui/` | Components, stories | **What this slice shows.** Only in `ui.*` and `core.ui`. |

## Rules

1. **Same 4 segment names everywhere** — no custom segment names.
2. **Only create segments that have content** — don't create empty folders.
3. **Tests co-locate inside their segment** — `tab.service.test.ts` lives next to `tab.service.ts`.
4. **`lib/` is always pure** — no Effect services, no `yield*`, no side effects. Plain functions, plain unit tests.
5. **`model/` never imports from `api/`** — models are depended on, not dependents.

## Which Segments Each Package Type Uses

```
                          model/    api/    lib/    ui/
                          ──────    ────    ────    ────
core.shared                 ✓                ✓
core.ui                     ✓                ✓       ✓
domain.adapter.*            ✓        ✓       ✓
domain.feature.*            ✓        ✓       ✓
domain.service.*            ✓        ✓
ui.adapter.*                         ✓       ✓
ui.feature.*                ✓        ✓               ✓
ui.scenes                                             ✓
```

## What Goes Where — Examples

**`model/`**
- Domain types (`Tab`, `Bookmark`) in `core.shared/src/model/types.ts`
- Ports (`Context.Tag` definitions) in `core.shared/src/model/ports.ts`
- Drizzle table schemas in `domain.adapter.db/src/model/tabs.schema.ts`
- PubSub + Stream type definitions in `domain.feature.session/src/model/session.events.ts`
- Component prop mappings in `ui.feature.sidebar/src/model/sidebar.bindings.ts`

**`api/`**
- Repository implementations in `domain.adapter.db/src/api/tab.repository.ts`
- Feature services in `domain.feature.tab/src/api/tab.service.ts`
- Application services in `domain.service.browsing/src/api/browsing.service.ts`
- `useService` + `useStream` wiring in `ui.feature.sidebar/src/api/use-sidebar.ts`

**`lib/`**
- `withTracing` utility in `core.shared/src/lib/with-tracing.ts`
- `spanName` helper in `core.shared/src/lib/span-name.ts`
- `makeRepository` factory in `domain.adapter.db/src/lib/make-repository.ts`
- Constants (`SESSION_FEATURE`, `BROWSING_SERVICE`) in each package's `lib/constants.ts`

**`ui/`**
- Component atoms/molecules/organisms in `core.ui/src/ui/`
- Feature composition components in `ui.feature.sidebar/src/ui/SidebarFeature.tsx`
- Stories in `ui.feature.sidebar/src/ui/SidebarFeature.stories.tsx`
- Page compositions in `ui.scenes/src/ui/MainPage.tsx`

For GritQL rules that enforce these segment boundaries, see `docs/architecture/dependency-matrix.md`.
For deep details see `docs/superpowers/specs/2026-03-14-domain-architecture-design.md` (Section 3).
