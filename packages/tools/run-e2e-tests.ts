#!/usr/bin/env bun

import { spawn } from "child_process";
import { existsSync } from "fs";

const CDP_URL = "http://localhost:9222/json/version";
const MAX_WAIT_TIME = 30000; // 30 seconds
const CHECK_INTERVAL = 2000; // 2 seconds

async function waitForCDP(): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_WAIT_TIME) {
    try {
      const response = await fetch(CDP_URL);
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ CDP ready! Browser: ${data.Browser}`);
        return true;
      }
    } catch (e) {
      // Not ready yet
    }

    console.log("⏳ Waiting for CDP...");
    await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
  }

  return false;
}

async function runE2ETests() {
  console.log("🚀 Starting E2E tests...\n");

  // 1. Start the desktop app with CDP enabled
  console.log("📱 Starting desktop app with CDP...");
  const appProcess = spawn("bun", ["run", "dev:e2e"], {
    cwd: "packages/apps/desktop",
    env: {
      ...process.env,
      ENABLE_CDP: "true",
      NODE_ENV: "development"
    },
    stdio: "inherit"
  });

  // 2. Wait for CDP to be ready
  console.log("\n⏳ Waiting for CDP to be available...");
  const cdpReady = await waitForCDP();

  if (!cdpReady) {
    console.error("❌ CDP failed to start");
    appProcess.kill();
    process.exit(1);
  }

  // 3. Run the tests
  console.log("\n🧪 Running E2E tests...");
  const testProcess = spawn("bun", ["run", "test:e2e"], {
    cwd: "packages/apps/desktop-e2e",
    stdio: "inherit"
  });

  // Wait for tests to complete
  await new Promise<void>((resolve, reject) => {
    testProcess.on("exit", (code) => {
      if (code === 0) {
        console.log("\n✅ E2E tests completed successfully!");
        resolve();
      } else {
        console.error(`\n❌ E2E tests failed with code ${code}`);
        reject(new Error(`Tests failed with code ${code}`));
      }
    });
  });

  // 4. Cleanup
  console.log("\n🧹 Cleaning up...");
  appProcess.kill();
  process.exit(0);
}

// Handle cleanup on exit
process.on("SIGINT", () => {
  console.log("\n🛑 Interrupted, cleaning up...");
  process.exit(1);
});

// Run
runE2ETests().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});