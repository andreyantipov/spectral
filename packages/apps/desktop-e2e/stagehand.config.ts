import type { StagehandConfig } from "@stagehand/playwright";

export default {
  // Connect to Electrobun app via CDP
  cdp: {
    url: "http://localhost:9222",  // CDP port from electrobun.config.ts
    timeout: 30000,
  },

  // Test configuration
  test: {
    cacheDir: ".stagehand/cache",  // Store AI recordings
    headless: false,  // Show browser for desktop app
    viewport: { width: 1200, height: 800 },
  },

  // AI model configuration (for recording mode)
  ai: {
    model: "claude-3-opus",  // Use Opus for better accuracy
    temperature: 0.1,  // Low temperature for consistency
  },

  // Test patterns
  testMatch: ["tests/**/*.spec.ts"],

  // Retry configuration
  retries: process.env.CI ? 2 : 0,

  // Timeout for each test
  timeout: 60000,
} satisfies StagehandConfig;