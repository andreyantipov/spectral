# Claude Code Instructions for ctrl.page

## Project Overview
ctrl.page is a project managed with Claude Code assistance.

## Development Guidelines
- Follow clean code principles
- Write clear, concise commit messages
- Use meaningful variable and function names
- **Detailed guidelines**: @.claude/docs/development.md

## PR Process
Every PR must be prefixed with type: `feat:`, `fix:`, `proto:`, `arch:`, `infra:`, `docs:`
- **Full PR guidelines**: @.claude/docs/pr-guidelines.md

## Architecture Rules
- `type` only, never `interface` in packages/libs/
- No `Effect.withSpan()` — use `withTracing()` from `@ctrl/base.tracing`
- Three services: WebBrowsing, Workspace, System (EventBus choreography)
- **Full architecture rules**: @.claude/docs/architecture.md

## UI Validation
After any UI change, **always validate visually** with screenshots.
- **Validation guide**: @.claude/docs/ui-validation.md

## Quick Commands
```bash
# Check architecture
ast-grep scan
bun run lint:dead-code  # knip
bun run lint:deps       # sherif

# Build & test
bun run build --force
bun run test  # or: turbo test

# Documentation
bun run docs:build
bun run docs:deps  # dependency graph
```

## App Icon
Icon assets: `packages/apps/desktop/assets/`
To update: replace `icon-source.png` and run generation script

## Recent Changes (Apr 2025)
- Tiling redesign: CSS Grid instead of dockview
- Three services split: WebBrowsing, Workspace, System
- EventBus choreography via typedSend
- New workspace commands: ws.split-panel, ws.move-panel, etc.

## Important Notes
- This file provides core context to Claude Code
- Update when project structure changes significantly
- Keep under 100 lines for optimal performance