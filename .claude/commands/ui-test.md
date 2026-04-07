# UI Testing & Validation

Validate UI changes thoroughly:

1. **Start the app** in agentic mode:
   ```bash
   nohup bun run dev:desktop:agentic > /tmp/ctrl-page-dev.log 2>&1 &
   ```

2. **Rebuild if needed**:
   ```bash
   bun run build --force
   ```

3. **Take screenshot**:
   ```bash
   osascript -e 'tell application "System Events" to tell process "bun" to set frontmost to true'
   sleep 1
   screencapture /tmp/ctrl-page-screenshot.png
   ```

4. **Read and analyze** the screenshot to verify:
   - Layout is correct
   - No visual glitches
   - Expected elements are visible
   - Styling matches design

5. **Check logs** for errors:
   ```bash
   tail -100 /tmp/ctrl-page-dev.log | grep -i error
   ```

6. **Check OTEL traces**:
   ```bash
   tail -100 /tmp/ctrl-page-telemetry.jsonl
   ```

7. **Clean up**:
   ```bash
   pkill -f "dev:desktop:agentic"
   sleep 1
   lsof -ti :4318 :4317 2>/dev/null | xargs kill -9 2>/dev/null
   ```

Report any visual issues found with screenshots.