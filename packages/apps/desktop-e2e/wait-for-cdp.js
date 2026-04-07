#!/usr/bin/env node

/**
 * Wait for CDP to be available before running tests
 */

async function waitForCDP(url = 'http://localhost:9222', maxAttempts = 30, delay = 2000) {
  console.log(`⏳ Waiting for CDP at ${url}...`);

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${url}/json/version`);
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ CDP ready! Browser: ${data.Browser}`);
        return true;
      }
    } catch (error) {
      // Connection refused, app not ready yet
    }

    if (i < maxAttempts - 1) {
      console.log(`  Attempt ${i + 1}/${maxAttempts} - CDP not ready, waiting ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  console.error(`❌ CDP not available after ${maxAttempts} attempts`);
  process.exit(1);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  waitForCDP();
}