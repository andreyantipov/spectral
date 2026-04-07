# Add New Event Command

Guide me through adding a new EventBus command/event to the system:

1. **Get event details**:
   - Event name (e.g., "foo.action")
   - Payload structure
   - Expected response type
   - Which service should handle it

2. **Create event definition** in `core.contract.event-bus/src/groups/{domain}.ts`

3. **Add to AppEvents** in `core.contract.event-bus/src/groups/schema.ts`

4. **Create handler** in appropriate service:
   - `domain.service.workspace` for workspace commands
   - `domain.service.system` for system/UI/settings
   - `domain.service.web-browsing` for session/navigation

5. **Wire handler** in `wire.desktop.main/src/index.ts`

6. **Add to MUTATION_ACTIONS** if it changes state

7. **Create UI dispatch** code

8. **Test the event** end-to-end

Ask for the event specifications first, then implement step by step.