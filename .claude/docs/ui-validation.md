# UI Validation Guide

After any UI/frontend change, **always validate visually** before claiming it works:

## Validation Steps

1. **Take screenshots**:
   ```bash
   screencapture /tmp/ctrl-page-screenshot.png
   # Then Read the file
   ```

2. **Bring app to front**:
   ```bash
   osascript -e 'tell application "System Events" to tell process "bun" to set frontmost to true'
   ```

3. **Check OTEL traces**:
   ```bash
   Read /tmp/ctrl-page-telemetry.jsonl
   # Or parse with python3 for span analysis
   ```

4. **Rebuild**:
   ```bash
   bun run build --force
   # Note: hot reload is NOT available, app must be restarted manually
   ```

5. **Restart app**:
   Kill the electrobun process and re-run `bun run dev:desktop`

Never claim a UI fix works based only on build success or trace data. Visual confirmation via screenshot is required.

## Agentic Dev Mode

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
- No storybook/watch-ui
- Includes OTEL collector for traces