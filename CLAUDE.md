# Claude Code Instructions for ctrl.page

## Project Overview

ctrl.page is a project managed with Claude Code assistance.

## Development Guidelines

- Follow clean code principles
- Write clear, concise commit messages
- Use meaningful variable and function names
- Add comments only where logic is not self-evident

## Ollama

A local Ollama instance is available via MCP tools (`ollama_chat`, `ollama_generate`, etc.). Use it to offload work that doesn't require Claude-level reasoning — code generation from simple prompts, boilerplate, format conversions, summaries — to save API tokens and reduce latency when appropriate.

## Code Style

- Use consistent formatting
- Prefer explicit over implicit
- Keep functions small and focused

## Testing

- Write tests for new functionality
- Ensure all tests pass before committing

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
- Two public surfaces: `domain.service.*` (for UI) and `ui.pages` (for apps)

## Notes

- This file provides context to Claude Code when working on this project
- Update this file as the project evolves
