# Desktop E2E Tests

End-to-end tests for the Spectral desktop app using Stagehand AI-powered testing.

## Setup

1. Install dependencies:
```bash
bun install
```

2. Start the app with CDP enabled:
```bash
# From packages/apps/desktop
bun run dev:e2e
```

3. Run tests:
```bash
# Record new test actions (requires AI)
bun run test:e2e:record

# Run tests (uses cached actions from first run)
bun run test:e2e

# Run in CI (uses cached actions, no AI needed)
bun run test:e2e:ci
```

## How it Works

1. **Recording Mode** (`test:e2e:record`):
   - Uses Claude/GPT to interpret natural language actions
   - Records actual DOM interactions to `.stagehand/cache/`
   - These recordings are committed to git

2. **Playback Mode** (`test:e2e`):
   - Replays cached actions from `.stagehand/cache/`
   - No AI needed after initial recording
   - Deterministic and fast

3. **CI Mode** (`test:e2e:ci`):
   - Same as playback but optimized for CI
   - Uses cached actions only
   - Fails if cache is missing

## Architecture

- **CDP Connection**: Connects to Electrobun app via Chrome DevTools Protocol on port 9222
- **Stagehand**: AI-powered testing framework that translates natural language to Playwright actions
- **Cache**: Actions are cached in `.stagehand/cache/` and committed to git
- **Turbo Integration**: Integrated with Turbo for dependency management

## Test Structure

```
tests/
├── session.spec.ts    # Browser session management
├── workspace.spec.ts  # Tiling and panel management
└── navigation.spec.ts # URL navigation and tabs
```

## Debugging

- Use `bun run test:e2e:debug` for step-by-step debugging
- Check CDP connection at http://localhost:9222
- View recordings in `.stagehand/cache/`