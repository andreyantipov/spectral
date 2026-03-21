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

## Notes

- This file provides context to Claude Code when working on this project
- Update this file as the project evolves
