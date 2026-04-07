# Quick Prototype

Create a fast prototype (proto:) PR for experimental features:

1. **Create feature branch** with `proto/` prefix:
   ```bash
   git checkout -b proto/feature-name
   ```

2. **Implement quickly**:
   - Focus on proving the concept works
   - Skip edge cases and error handling
   - Use `any` types if needed temporarily
   - Add TODO comments for cleanup

3. **Basic testing**:
   - Ensure it compiles
   - Manual test the happy path
   - Take screenshot if UI change

4. **Create proto: PR**:
   - Title: `proto: <description>`
   - Body: Explain what you're testing
   - Note: "Follow-up cleanup PR needed"

5. **After merge**, create cleanup issue listing:
   - TODOs to address
   - Edge cases to handle
   - Types to fix
   - Tests to add

Remember: proto: PRs are for learning, not production.