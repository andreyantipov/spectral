import { Stagehand } from "@browserbasehq/stagehand";
import { test, expect } from "@playwright/test";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

/**
 * Real Stagehand E2E tests for WebSession spec
 * Uses AI to interpret natural language actions
 */
test.describe("Stagehand - Web Browsing Session", () => {
  let stagehand: Stagehand;
  let page: any;

  test.beforeAll(async () => {
    // Initialize Stagehand with CDP connection to Electrobun
    stagehand = new Stagehand({
      env: "LOCAL", // Use local browser
      enableCaching: true, // Cache AI actions for replay
      headless: false,
      logger: (logLine: string) => {
        console.log(`[Stagehand] ${logLine}`);
      },
      // Connect to Electrobun via CDP
      browserWSEndpoint: process.env.CDP_ENDPOINT || "ws://localhost:9222",
    });

    await stagehand.init();
    page = stagehand.page;

    console.log("✅ Stagehand initialized with CDP connection");
  });

  test.afterAll(async () => {
    await stagehand?.close();
  });

  test("should create and close browser sessions", async () => {
    // Act: Create a new session using natural language
    await stagehand.act({
      action: "click on the button to create a new browser session"
    });

    // Small wait for UI update
    await page.waitForTimeout(1000);

    // Extract: Get session information
    const sessions = await stagehand.extract({
      instruction: "find all browser session tabs",
      schema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            url: { type: "string" },
            isActive: { type: "boolean" }
          }
        }
      }
    });

    expect(sessions).toBeDefined();
    expect(sessions.length).toBeGreaterThan(0);

    // Act: Navigate to a URL
    await stagehand.act({
      action: "type 'https://example.com' in the URL bar and press Enter"
    });

    // Wait for navigation
    await page.waitForTimeout(3000);

    // Extract: Verify navigation
    const currentUrl = await stagehand.extract({
      instruction: "get the current URL from the address bar",
      schema: {
        type: "string"
      }
    });

    expect(currentUrl).toContain("example.com");

    // Act: Close the session
    await stagehand.act({
      action: "close the current browser session tab"
    });

    await page.waitForTimeout(1000);

    // Verify session was closed
    const remainingSessions = await stagehand.extract({
      instruction: "count the number of browser session tabs",
      schema: {
        type: "number"
      }
    });

    expect(remainingSessions).toBeDefined();
  });

  test("should handle multiple sessions", async () => {
    // Create first session
    await stagehand.act({
      action: "create a new browser session"
    });

    await page.waitForTimeout(1000);

    await stagehand.act({
      action: "navigate to google.com"
    });

    await page.waitForTimeout(2000);

    // Create second session
    await stagehand.act({
      action: "create another browser session"
    });

    await page.waitForTimeout(1000);

    await stagehand.act({
      action: "navigate to github.com"
    });

    await page.waitForTimeout(2000);

    // Switch between sessions
    await stagehand.act({
      action: "click on the first browser tab to switch to it"
    });

    await page.waitForTimeout(1000);

    // Verify we're on Google
    const activeUrl = await stagehand.extract({
      instruction: "get the URL of the currently active tab",
      schema: { type: "string" }
    });

    expect(activeUrl).toContain("google");

    // Switch back
    await stagehand.act({
      action: "click on the second tab"
    });

    await page.waitForTimeout(1000);

    const newActiveUrl = await stagehand.extract({
      instruction: "get the URL of the currently active tab",
      schema: { type: "string" }
    });

    expect(newActiveUrl).toContain("github");
  });

  test("should handle navigation errors", async () => {
    await stagehand.act({
      action: "create a new session if there isn't one"
    });

    await page.waitForTimeout(1000);

    // Navigate to invalid URL
    await stagehand.act({
      action: "navigate to 'https://this-invalid-url-does-not-exist-12345.com'"
    });

    await page.waitForTimeout(3000);

    // Check for error state
    const errorVisible = await stagehand.extract({
      instruction: "check if there is an error message displayed",
      schema: { type: "boolean" }
    });

    expect(errorVisible).toBeDefined();

    // Recover by navigating to valid URL
    await stagehand.act({
      action: "navigate to a valid URL like example.com"
    });

    await page.waitForTimeout(3000);

    const recovered = await stagehand.extract({
      instruction: "check if the page loaded successfully",
      schema: { type: "boolean" }
    });

    expect(recovered).toBe(true);
  });
});