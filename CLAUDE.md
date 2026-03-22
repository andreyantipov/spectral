# Claude Code Instructions for ctrl.page

## Project Overview

ctrl.page is a project managed with Claude Code assistance.

## Development Guidelines

- Follow clean code principles
- Write clear, concise commit messages
- Use meaningful variable and function names
- Add comments only where logic is not self-evident

## PR Types

Every PR title must be prefixed with a type. This enables filtering git history by intent.

| Prefix | Meaning | Review expectation |
|--------|---------|-------------------|
| `feat:` | Production-ready feature | Full review, tests required |
| `fix:` | Bug fix | Focused review on the fix |
| `proto:` | Fast prototyping / proof of concept | Minimal review, rough edges expected, follow-up cleanup PR needed |
| `arch:` | Architecture shift / refactor | Deep review, no behavior change |
| `infra:` | CI/CD, tooling, dev environment | Light review |
| `docs:` | Documentation only | Skim |

PRs must pass CI (green checks) before merge — no exceptions including `proto:`.

## Ollama

A local Ollama instance is available via MCP tools (`ollama_chat`, `ollama_generate`, etc.). Use it to offload work that doesn't require Claude-level reasoning — code generation from simple prompts, boilerplate, format conversions, summaries — to save API tokens and reduce latency when appropriate.

## Code Style

- Use consistent formatting
- Prefer explicit over implicit
- Keep functions small and focused

## Testing

- Write tests for new functionality
- Ensure all tests pass before committing

## UI Validation

After any UI/frontend change, **always validate visually** before claiming it works:

1. **Take screenshots**: `screencapture /tmp/ctrl-page-screenshot.png` then `Read` the file
2. **Bring app to front**: `osascript -e 'tell application "System Events" to tell process "bun" to set frontmost to true'`
3. **Check OTEL traces**: `Read /tmp/ctrl-page-telemetry.jsonl` or parse with python3 for span analysis
4. **Rebuild**: `bun run build --force` — hot reload is NOT available, app must be restarted manually after builds
5. **Restart app**: Kill the electrobun process and re-run `bun run dev:desktop` — or ask the user to restart

Never claim a UI fix works based only on build success or trace data. Visual confirmation via screenshot is required.

### Agentic Dev Mode

Use `dev:desktop:agentic` for autonomous development:

```bash
# Start (no TUI, stdout readable, includes OTEL collector)
nohup bun run dev:desktop:agentic > /tmp/ctrl-page-dev.log 2>&1 &

# Monitor logs
tail -f /tmp/ctrl-page-dev.log

# Kill cleanly
pkill -f "dev:desktop:agentic"
sleep 1
lsof -ti :4318 :4317 2>/dev/null | xargs kill -9 2>/dev/null

# Screenshot
osascript -e 'tell application "System Events" to tell process "bun" to set frontmost to true'
sleep 1
screencapture /tmp/ctrl-page-screenshot.png
# Then Read /tmp/ctrl-page-screenshot.png to view

# Check traces
cat /tmp/ctrl-page-telemetry.jsonl | python3 -c "import json,sys; ..."
```

Key differences from `dev:desktop`:
- `--ui=stream` — no interactive TUI, stdout is plain text
- `--log-order=stream` — chronological output
- No storybook/watch-ui (not needed for agent testing)
- Includes OTEL collector for traces

## Architecture

- Package naming: see `docs/architecture/package-naming.md`
- FSD segments: see `docs/architecture/fsd-segments.md`
- Dependencies: see `docs/architecture/dependency-matrix.md`
- Testing: see `docs/architecture/testing-strategy.md`
- Full spec: see `docs/superpowers/specs/2026-03-14-domain-architecture-design.md`

### Key Rules
- `type` only, never `interface` in packages/libs/
- No `Effect.withSpan()` — use `withTracing()` from `@ctrl/core.shared`
- No hardcoded strings for span names or service identifiers
- GritQL enforces all boundaries — run `bunx grit check .` before committing
- Two public surfaces: `domain.service.*` (for UI) and `ui.scenes` (for apps)
- **`BrowsingRpcs`** is the service contract — an `@effect/rpc` `RpcGroup` exported from `domain.service.browsing`. There is no separate `BrowsingService` `Context.Tag`.
- **`Effect Schema` is the single source of truth** for domain types — derive TypeScript types from schemas, never duplicate them.
- The browsing unit of work is a **session** — use `domain.feature.session` not `domain.feature.tab`. Constants use `SESSION_FEATURE`, not `TAB_FEATURE`.

### Package Deprecation
When a package needs an incompatible rewrite, use the **deprecation fork** pattern. Maximum TWO versions exist at any time:

```
Step 1: Rename current → domain.feature.session-deprecated
Step 2: Create new → domain.feature.session (fresh, incompatible)
Step 3: Migrate all consumers from deprecated → new
Step 4: Delete domain.feature.session-deprecated
```

Rules:
- Never `v1`, `v2`, `v3` — only `current` and `-deprecated`
- If you need to break again before migration is done — finish the migration first
- Add `/** @deprecated Use X instead */` to the barrel export
- A grit rule blocks NEW imports of `-deprecated` packages

### Core Package Levels
Three-tier core structure, each level can only import levels above it:

```
Level 1: core.port.*    → pure interfaces (Context.Tag + type signatures), zero deps
Level 2: core.shared     → schemas, errors, utilities (imports core.port.*)
Level 3: core.ui         → components, hooks (imports core.shared + core.port.*)
```

Ports are **atomic packages** — one per concern:
- `core.port.storage` → SessionRepository, BookmarkRepository, HistoryRepository, LayoutRepository
- `core.ports.webview` → WebviewExecutor
- `core.ports.event-bus` → EventBus
- Each adapter imports only the ports it implements

### Carrier + EventBus
Two concerns for cross-process communication:

```
Carrier (infrastructure):
  IPC (needed for Electrobun/Bun) + RPC (needed for Effect)
  Native ←──IPC──→ Bun ←──RPC──→ Webview

EventBus (business logic):
  ALL commands and events flow here
  Commands: session.create, nav.navigate, ws.split, ...
  Events: session.created, nav.navigated, ...
```

- **Carrier** (IPC+RPC) = infrastructure. Serialization, encryption, process boundaries. Invisible to business code.
- **EventBus** = where ALL business happens. Every command, every event, every subscriber. Features and services never touch the carrier directly — they only speak EventBus.
- See: `docs/superpowers/specs/2026-03-22-event-driven-architecture-design.md`

## App Icon

All icon assets live in `packages/apps/desktop/assets/`:

```
assets/
  icon-source.png          ← 1024x1024 source PNG (replace this to update)
  icon-exports/            ← all Icon Composer exports (Default, Dark, Tinted, etc.)
  icon.iconset/            ← generated sizes for macOS
  icon.icns                ← generated .icns bundle
  apply-macos-mask.py      ← squircle mask script
```

### Updating the icon

1. Replace `assets/icon-source.png` with new 1024x1024 PNG
2. If from Icon Composer, also update `assets/icon-exports/` with all variants
3. Generate iconset:
   ```bash
   cd packages/apps/desktop
   python3 assets/apply-macos-mask.py assets/icon-source.png /tmp/icon-masked.png
   S="/tmp/icon-masked.png"; I="assets/icon.iconset"
   sips -z 16 16 $S --out $I/icon_16x16.png
   sips -z 32 32 $S --out $I/icon_16x16@2x.png
   sips -z 32 32 $S --out $I/icon_32x32.png
   sips -z 64 64 $S --out $I/icon_32x32@2x.png
   sips -z 128 128 $S --out $I/icon_128x128.png
   sips -z 256 256 $S --out $I/icon_128x128@2x.png
   sips -z 256 256 $S --out $I/icon_256x256.png
   sips -z 512 512 $S --out $I/icon_256x256@2x.png
   sips -z 512 512 $S --out $I/icon_512x512.png
   cp $S $I/icon_512x512@2x.png
   iconutil -c icns $I -o assets/icon.icns
   ```
4. Commit everything, clear Dock cache: `sudo killall Dock`

The mask script adds transparent squircle corners (Electrobun doesn't apply runtime masking).

## Notes

- This file provides context to Claude Code when working on this project
- Update this file as the project evolves
