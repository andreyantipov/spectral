# Development Guidelines

## Environment Setup

All CLI sessions and agents must run inside `nix develop` to ensure tools are available.

## CLI Tools (nix)

| Tool | Use for | Example |
|------|---------|---------|
| `fd` | Find files fast | `fd '\.test\.ts$' packages/libs/` |
| `sd` | Search-and-replace | `sd 'OldName' 'NewName' $(fd -e ts)` |
| `tokei` | Lines of code stats | `tokei packages/libs/` |
| `delta` | Syntax-highlighted diffs | `git diff \| delta` |

Prefer `fd` + `sd` for mass renames.

## Ollama

Local Ollama instance available via MCP tools. Use for:
- Code generation from simple prompts
- Boilerplate creation
- Format conversions
- Summaries

## Code Style
- Use consistent formatting
- Prefer explicit over implicit
- Keep functions small and focused
- Write tests for new functionality

## Testing
- Write tests for new functionality
- Ensure all tests pass before committing

## How to Add a New Command (end-to-end)

1. Define event in `core.contract.event-bus/src/groups/{domain}.ts`:
   ```ts
   export const FooEvents = EventGroup.empty.add({
     tag: "foo.action",
     primaryKey: (p) => p.id,
     payload: Schema.Struct({ id: Schema.String }),
     success: Schema.Void,
   });
   ```

2. Add to `AppEvents` in `core.contract.event-bus/src/groups/schema.ts`

3. Add handler via `EventLog.group()` in appropriate service

4. Wire handler in `wire.desktop.main/src/index.ts`

5. Add tag to `MUTATION_ACTIONS` set if it changes state

6. Dispatch from UI: `api.dispatch("foo.action", { id })`

7. Subscribe in UI: `api.on("browsing.snapshot")`

Files touched: 4-5. No new packages unless new domain concept.

## Documentation

```bash
bun run docs:build              # Regenerate all docs
bun run docs:deps               # Generate dependency graph
```

Generated files:
- `docs/architecture/GENERATED.md` — package map, events, services
- `docs/architecture/dependency-graph.svg` — import graph
- `packages/apps/dev-docs/` — EventCatalog