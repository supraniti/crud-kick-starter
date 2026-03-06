import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const CURRENT_FILE = fileURLToPath(import.meta.url);
const CURRENT_DIR = path.dirname(CURRENT_FILE);
const ROOT_DIR = path.resolve(CURRENT_DIR, "..", "..");
const ARTIFACT_ROOT = path.join(ROOT_DIR, "e2e", "smoke", "artifacts");
const REUSE_EXISTING_SERVER =
  process.env.CI !== "true" && process.env.CI !== "1";

export default defineConfig({
  testDir: path.join(ROOT_DIR, "e2e", "smoke", "specs"),
  testMatch: "**/*.e2e.test.mjs",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile: path.join(ARTIFACT_ROOT, "playwright-report.json")
      }
    ]
  ],
  outputDir: path.join(ARTIFACT_ROOT, "test-output"),
  use: {
    baseURL: "http://127.0.0.1:3000",
    browserName: "chromium",
    channel: "chrome",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off"
  },
  webServer: [
    {
      command: "pnpm --filter server start",
      url: "http://127.0.0.1:3001/health",
      reuseExistingServer: REUSE_EXISTING_SERVER,
      timeout: 120_000,
      env: {
        REFERENCE_MODULE_ID_TRANSLATION_MODE: "dual-compat",
        REFERENCE_STATE_MODE: "memory"
      }
    },
    {
      command: "pnpm --filter frontend dev --host 127.0.0.1 --port 3000 --strictPort",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: REUSE_EXISTING_SERVER,
      timeout: 120_000,
      env: {
        VITE_SERVER_ORIGIN: "http://127.0.0.1:3001"
      }
    }
  ]
});
