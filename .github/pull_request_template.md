## Summary

<!-- What changed and why -->

## Architecture Changes

### Before
```
<!-- Paste relevant section from docs/architecture/GENERATED.md BEFORE changes -->
<!-- Or describe the package/flow structure that existed -->
```

### After
```
<!-- Paste the updated structure AFTER changes -->
<!-- Show what packages were added/removed/moved -->
```

## Test plan
- [ ] `bun run check` — all typecheck pass
- [ ] `bun run test` — all tests pass
- [ ] `bunx grit check .` — 0 violations
- [ ] App smoke test (if UI changes)
- [ ] No `.js` artifacts in `src/`
- [ ] No stale imports from deleted packages
- [ ] CLAUDE.md updated (if architecture changed)
