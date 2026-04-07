// In production, use real Stagehand: import { test, expect } from "@stagehand/playwright";
// For testing without AI backend, use mock:
import { test, expect } from "./stagehand-mock";

/**
 * E2E tests for WebSession spec implementation
 * Based on packages/libs/base.spec.web-session/src/web-session.ts
 */
test.describe("Web Browsing - Session Management", () => {
  test.beforeEach(async ({ page }) => {
    // Connect to running Electrobun app via CDP
    await page.goto("http://localhost:9222");

    // Wait for app to be ready
    await page.waitForSelector("[data-testid='workspace']", { timeout: 10000 });
  });

  test("CreateSession: should create a new browsing session", async ({ page, ai }) => {
    // State: Idle -> Browsing
    // Effects: InsertSession, ActivateSession

    // Count initial sessions
    const initialSessions = await page.locator("[data-testid='session-tab']");
    const initialCount = await initialSessions.count();

    // Action: CreateSession
    await ai.action("Click the 'New Session' or '+' button to create a new browser session");

    // Alternative for CI without AI:
    // await page.click("[data-testid='new-session-button']");
    // Or dispatch via EventBus:
    // await page.evaluate(() => window.api?.dispatch("session.create", { mode: "browsing" }));

    // Verify session was inserted
    await page.waitForTimeout(500);
    const sessionsAfter = await page.locator("[data-testid='session-tab']");
    const countAfter = await sessionsAfter.count();
    expect(countAfter).toBe(initialCount + 1);

    // Verify new session is active
    const newSession = sessionsAfter.last();
    const isActive = await newSession.getAttribute("data-active");
    expect(isActive).toBe("true");

    // Verify state is Browsing (not Loading or Error)
    const sessionState = await page.locator("[data-testid='session-state']").last();
    const state = await sessionState.getAttribute("data-state");
    expect(state).toBe("browsing");
  });

  test("Navigate: should navigate to URL and update title", async ({ page, ai }) => {
    // State: Browsing -> Loading -> Browsing
    // Effects: StartNavigation, WriteUrl, WriteTitle, WriteFavicon, RecordHistory

    // Create a session first
    await ai.action("Create a new browser session");
    await page.waitForTimeout(500);

    // Action: Navigate
    const testUrl = "https://example.com";
    await ai.action(`Type '${testUrl}' in the URL bar and press Enter`);

    // Alternative for CI:
    // await page.fill("[data-testid='url-input']", testUrl);
    // await page.press("[data-testid='url-input']", "Enter");
    // Or via EventBus:
    // await page.evaluate((url) => window.api?.dispatch("nav.navigate", { url }), testUrl);

    // Verify Loading state briefly
    const loadingIndicator = page.locator("[data-testid='loading-indicator']");
    await expect(loadingIndicator).toBeVisible({ timeout: 5000 });

    // Wait for navigation to complete
    await page.waitForTimeout(3000);

    // Verify URL was written
    const urlBar = await page.locator("[data-testid='url-input']");
    await expect(urlBar).toHaveValue(testUrl);

    // Verify Title was written (after UrlCommitted)
    const sessionTab = await page.locator("[data-testid='session-tab']").last();
    const title = await sessionTab.locator("[data-testid='tab-title']").textContent();
    expect(title).toBeTruthy();
    expect(title).not.toBe("New Tab");  // Should have actual page title

    // Verify state returned to Browsing
    const sessionState = await page.locator("[data-testid='session-state']").last();
    const finalState = await sessionState.getAttribute("data-state");
    expect(finalState).toBe("browsing");
  });

  test("CloseSession: should close session and handle last session", async ({ page, ai }) => {
    // State: Browsing -> Closed
    // Effects: RemoveSession (with wasLast flag)

    // Create two sessions to test non-last close
    await ai.action("Create a new browser session");
    await page.waitForTimeout(300);
    await ai.action("Create another browser session");
    await page.waitForTimeout(300);

    const sessions = await page.locator("[data-testid='session-tab']");
    const initialCount = await sessions.count();
    expect(initialCount).toBeGreaterThanOrEqual(2);

    // Action: CloseSession (not last)
    await ai.action("Close the active session by clicking the 'x' button");

    // Alternative for CI:
    // await page.click("[data-testid='session-close']:last");
    // Or via EventBus:
    // await page.evaluate(() => window.api?.dispatch("session.close", {}));

    await page.waitForTimeout(500);

    // Verify session was removed
    const sessionsAfter = await page.locator("[data-testid='session-tab']");
    const countAfter = await sessionsAfter.count();
    expect(countAfter).toBe(initialCount - 1);

    // Now close the last session
    await ai.action("Close the last remaining session");
    await page.waitForTimeout(500);

    // Verify app behavior when last session is closed
    // Could be: new empty session created, or app shows welcome screen
    const finalSessions = await page.locator("[data-testid='session-tab']");
    const finalCount = await finalSessions.count();

    // App should either create a new session or show welcome
    if (finalCount === 0) {
      const welcomeScreen = await page.locator("[data-testid='welcome-screen']");
      await expect(welcomeScreen).toBeVisible();
    } else {
      expect(finalCount).toBe(1);  // New empty session
    }
  });

  test("ActivateSession: should switch between multiple sessions", async ({ page, ai }) => {
    // State: Browsing -> Browsing
    // Effects: ActivateSession

    // Create multiple sessions
    await ai.action("Create a new browser session");
    await page.waitForTimeout(300);
    await ai.action("Navigate to 'https://google.com'");
    await page.waitForTimeout(1000);

    await ai.action("Create another browser session");
    await page.waitForTimeout(300);
    await ai.action("Navigate to 'https://github.com'");
    await page.waitForTimeout(1000);

    const sessions = await page.locator("[data-testid='session-tab']");
    expect(await sessions.count()).toBeGreaterThanOrEqual(2);

    // Action: ActivateSession (click on first tab)
    await ai.action("Click on the first session tab to activate it");

    // Alternative for CI:
    // await sessions.first().click();

    await page.waitForTimeout(300);

    // Verify first session is active
    const firstSession = sessions.first();
    const firstActive = await firstSession.getAttribute("data-active");
    expect(firstActive).toBe("true");

    // Verify second session is not active
    const secondSession = sessions.nth(1);
    const secondActive = await secondSession.getAttribute("data-active");
    expect(secondActive).toBe("false");

    // Verify correct content is shown (Google)
    const urlBar = await page.locator("[data-testid='url-input']");
    const currentUrl = await urlBar.inputValue();
    expect(currentUrl).toContain("google.com");
  });

  test("NavigationFailed: should handle navigation errors", async ({ page, ai }) => {
    // State: Loading -> Error
    // Effects: SetError

    // Create a session
    await ai.action("Create a new browser session");
    await page.waitForTimeout(500);

    // Action: Navigate to invalid URL
    const invalidUrl = "https://this-definitely-does-not-exist-12345.com";
    await ai.action(`Type '${invalidUrl}' in the URL bar and press Enter`);

    // Alternative for CI:
    // await page.evaluate((url) => window.api?.dispatch("nav.navigate", { url }), invalidUrl);

    // Wait for error state
    await page.waitForTimeout(3000);

    // Verify Error state
    const sessionState = await page.locator("[data-testid='session-state']").last();
    const state = await sessionState.getAttribute("data-state");
    expect(state).toBe("error");

    // Verify error message is shown
    const errorMessage = await page.locator("[data-testid='navigation-error']");
    await expect(errorMessage).toBeVisible();
    const errorText = await errorMessage.textContent();
    expect(errorText).toBeTruthy();

    // Verify can recover from error by navigating again
    await ai.action("Navigate to 'https://example.com'");
    await page.waitForTimeout(3000);

    // Should be back in Browsing state
    const recoveredState = await sessionState.getAttribute("data-state");
    expect(recoveredState).toBe("browsing");
  });

  test("TitleChanged: should update tab title dynamically", async ({ page, ai }) => {
    // State: Browsing -> Browsing
    // Effects: WriteTitle

    // Create session and navigate
    await ai.action("Create a new browser session");
    await page.waitForTimeout(500);
    await ai.action("Navigate to 'https://example.com'");
    await page.waitForTimeout(3000);

    // Get initial title
    const sessionTab = await page.locator("[data-testid='session-tab']").last();
    const initialTitle = await sessionTab.locator("[data-testid='tab-title']").textContent();

    // Simulate title change (this would normally come from the web content)
    // In real scenario, the page's document.title change triggers TitleChanged action
    await page.evaluate(() => {
      window.api?.dispatch("session.title-changed", { title: "New Dynamic Title" });
    });

    await page.waitForTimeout(500);

    // Verify title was updated
    const updatedTitle = await sessionTab.locator("[data-testid='tab-title']").textContent();
    expect(updatedTitle).toBe("New Dynamic Title");
    expect(updatedTitle).not.toBe(initialTitle);
  });

  // Cleanup after all tests
  test.afterAll(async ({ page }) => {
    if (process.env.CI === "true") {
      // Signal app to quit in CI
      await page.evaluate(() => {
        console.log("E2E_TESTS_COMPLETE");
      });
    }
  });
});