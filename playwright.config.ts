import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const shouldStartServer = process.env.E2E_BASE_URL ? false : true;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: shouldStartServer
    ? {
        command: "npm run dev",
        port: 3000,
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});

