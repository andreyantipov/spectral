# Architecture Check

Perform a comprehensive architecture validation for the ctrl.page project:

1. **Run AST-Grep scan** to check architecture boundaries:
   ```bash
   ast-grep scan
   ```
   Fix any violations found.

2. **Check dependency graph**:
   ```bash
   bun run docs:deps
   ```
   Review the generated SVG for unexpected dependencies.

3. **Dead code detection**:
   ```bash
   bun run lint:dead-code
   ```
   Remove any unused exports, files, or dependencies.

4. **Dependency consistency**:
   ```bash
   bun run lint:deps
   ```
   Fix any version mismatches or ordering issues.

5. **Verify feature purity**:
   - Ensure no `domain.feature.*` imports `core.impl.*`
   - Check that features don't use EventBus/PubSub/Stream
   - Verify services properly handle EventBus commands

6. **Check Layer exports**:
   - Verify each `core.impl.*` package exports exactly one Layer
   - Ensure proper Layer composition in wiring

Report findings and fix critical issues.