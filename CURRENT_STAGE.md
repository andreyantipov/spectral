# Current Project Stage

## Active Branch: main
## Project: ctrl.page - Browser control interface

## Current Architecture State

### Core Services (EventBus-based)
- **WebBrowsingServiceLive**: Handles session/navigation/bookmarks
- **WorkspaceServiceLive**: Manages tiling layout (CSS Grid)
- **SystemServiceLive**: Controls UI/settings/diagnostics

### Recent Major Changes (Apr 2025)
- ✅ Tiling system redesigned (dockview → CSS Grid)
- ✅ Services split into 3 specialized units
- ✅ EventBus choreography via typedSend
- ✅ New workspace commands (ws.*)

## Next Priority Tasks
- [ ] Performance profiling of new tiling system
- [ ] Add session persistence layer
- [ ] Implement bookmark sync
- [ ] Add keyboard shortcut customization

## Key Entry Points
- Main wiring: `wire.desktop.main/src/index.ts`
- UI entry: `packages/apps/desktop/src/main.tsx`
- Event definitions: `core.contract.event-bus/src/groups/`
- Tiling logic: `domain.feature.layout/src/lib/tree-ops.ts`

## Quick Commands
```bash
# Start development
nix develop
bun run dev:desktop

# Architecture check
ast-grep scan
bun run lint:dead-code

# Generate docs
bun run docs:build
```

## Active Issues/Blockers
- None currently

## Notes for Next Session
- Read this file first with `/clear` to restore context
- Check @docs/architecture/GENERATED.md for latest structure
- Run `/arch-check` command for validation

Last updated: 2025-04-07