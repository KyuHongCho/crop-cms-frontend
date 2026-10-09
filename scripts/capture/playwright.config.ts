import { defineConfig, devices } from "@playwright/test";

// Separate from playwright.config.ts so `npm run e2e` and CI never run it.
const PORT = 5198;

export default defineConfig({
  testDir: ".",
  testMatch: "capture.shots.ts",
  workers: 1,
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${PORT}`, ...devices["Desktop Chrome"], viewport: { width: 1100, height: 760 } },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
