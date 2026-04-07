import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false, // Run tests sequentially for desktop app
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for desktop app
  reporter: "html",

  use: {
    // Connect to CDP
    baseURL: "http://localhost:9222",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        // Override to connect to CDP
        connectOptions: {
          wsEndpoint: "ws://localhost:9222",
        },
      },
    },
  ],

  // Don't start web server, we connect to running app
  webServer: undefined,
});