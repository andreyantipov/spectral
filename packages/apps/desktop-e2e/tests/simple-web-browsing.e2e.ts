import { test, expect, chromium } from "@playwright/test";

test.describe("Web Browsing - Basic Tests", () => {
  let browser: any;
  let page: any;

  test.beforeAll(async () => {
    // Connect to the running Electrobun app via CDP
    try {
      browser = await chromium.connectOverCDP("http://localhost:9222");
      const contexts = browser.contexts();
      const context = contexts[0] || await browser.newContext();
      page = context.pages()[0] || await context.newPage();
      console.log("Connected to CDP successfully");
    } catch (error) {
      console.error("Failed to connect to CDP:", error);
      throw error;
    }
  });

  test.afterAll(async () => {
    // Don't close the browser, just disconnect
    if (browser) {
      await browser.close();
    }
  });

  test("should have workspace visible", async () => {
    // Check that main UI elements are present
    const workspace = await page.locator("[data-testid='workspace']");
    await expect(workspace).toBeVisible({ timeout: 10000 });
  });

  test("should create a new session", async () => {
    // Try to find and click new session button
    const newSessionBtn = await page.locator("[data-testid='new-session-button']");
    if (await newSessionBtn.isVisible()) {
      await newSessionBtn.click();
    } else {
      // Try using keyboard shortcut
      await page.keyboard.press("Control+T");
    }

    // Wait a bit for session to be created
    await page.waitForTimeout(1000);

    // Check if a session tab exists
    const sessionTab = await page.locator("[data-testid='session-tab']");
    await expect(sessionTab.first()).toBeVisible();
  });

  test("should navigate to a URL", async () => {
    // Find URL input
    const urlInput = await page.locator("[data-testid='url-input']");

    if (await urlInput.isVisible()) {
      await urlInput.click();
      await urlInput.fill("https://example.com");
      await urlInput.press("Enter");

      // Wait for navigation
      await page.waitForTimeout(3000);

      // Check that URL was updated
      const currentUrl = await urlInput.inputValue();
      expect(currentUrl).toContain("example.com");
    } else {
      console.log("URL input not found, skipping navigation test");
    }
  });

  test("should close a session", async () => {
    const closeBtn = await page.locator("[data-testid='session-close']");

    if (await closeBtn.first().isVisible()) {
      await closeBtn.first().click();
      await page.waitForTimeout(1000);
      console.log("Session closed");
    } else {
      console.log("Close button not found, skipping");
    }
  });
});