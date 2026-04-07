/**
 * Mock implementation of Stagehand for testing without AI
 * In production, this would be replaced with real Stagehand that uses AI
 */

import { chromium, Page, Browser } from "@playwright/test";

export interface StagehandPage {
  page: Page;
  ai: {
    action: (instruction: string) => Promise<void>;
  };
}

export class MockStagehand {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async connect(): Promise<StagehandPage> {
    // Connect to CDP
    this.browser = await chromium.connectOverCDP("http://localhost:9222");
    const contexts = this.browser.contexts();
    const context = contexts[0] || await this.browser.newContext();
    this.page = context.pages()[0] || await context.newPage();

    return {
      page: this.page,
      ai: {
        action: async (instruction: string) => {
          // Mock AI actions - map natural language to Playwright commands
          console.log(`[Mock AI] Executing: ${instruction}`);

          if (!this.page) throw new Error("Page not initialized");

          // Simple pattern matching for common actions
          if (instruction.includes("Create a new") || instruction.includes("Click the '+' button")) {
            const btn = await this.page.locator("[data-testid='new-session-button']");
            if (await btn.isVisible()) {
              await btn.click();
            } else {
              await this.page.keyboard.press("Control+T");
            }
          }

          else if (instruction.includes("Navigate to")) {
            const urlMatch = instruction.match(/'([^']+)'/);
            if (urlMatch) {
              const url = urlMatch[1];
              const urlInput = await this.page.locator("[data-testid='url-input']");
              await urlInput.fill(url);
              await urlInput.press("Enter");
            }
          }

          else if (instruction.includes("Close") && instruction.includes("session")) {
            const closeBtn = await this.page.locator("[data-testid='session-close']");
            if (await closeBtn.first().isVisible()) {
              await closeBtn.first().click();
            }
          }

          else if (instruction.includes("Click on the first")) {
            const tabs = await this.page.locator("[data-testid='session-tab']");
            await tabs.first().click();
          }

          else if (instruction.includes("Type") && instruction.includes("URL bar")) {
            const urlMatch = instruction.match(/'([^']+)'/);
            if (urlMatch) {
              const url = urlMatch[1];
              const urlInput = await this.page.locator("[data-testid='url-input']");
              await urlInput.fill(url);
              if (instruction.includes("press Enter")) {
                await urlInput.press("Enter");
              }
            }
          }

          else {
            console.warn(`[Mock AI] Unknown action: ${instruction}`);
          }

          // Small delay to simulate AI processing
          await this.page.waitForTimeout(500);
        }
      }
    };
  }

  async disconnect() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Test helper
export const test = {
  describe: (name: string, fn: () => void) => {
    console.log(`Test suite: ${name}`);
    fn();
  },

  beforeEach: async (fn: (context: { page: Page, ai: any }) => Promise<void>) => {
    // This would be handled by test runner
  },

  test: async (name: string, fn: (context: { page: Page, ai: any }) => Promise<void>) => {
    console.log(`Test: ${name}`);
    const stagehand = new MockStagehand();
    const context = await stagehand.connect();

    try {
      await fn(context);
      console.log(`✅ ${name}`);
    } catch (error) {
      console.error(`❌ ${name}:`, error);
      throw error;
    } finally {
      await stagehand.disconnect();
    }
  }
};

export { expect } from "@playwright/test";