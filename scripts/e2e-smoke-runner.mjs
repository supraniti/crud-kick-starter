import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CURRENT_FILE = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(CURRENT_FILE), "..");
const ARTIFACT_ROOT = path.join(ROOT_DIR, "e2e", "smoke", "artifacts");
const SUMMARY_PATH = path.join(ARTIFACT_ROOT, "last-run-summary.json");

function ensureCleanArtifactsDir() {
  fs.rmSync(ARTIFACT_ROOT, {
    recursive: true,
    force: true
  });
  fs.mkdirSync(ARTIFACT_ROOT, {
    recursive: true
  });
}

function runPlaywrightSmoke() {
  return spawnSync(
    "pnpm",
    ["exec", "playwright", "test", "--config", "e2e/smoke/playwright.config.mjs"],
    {
      cwd: ROOT_DIR,
      stdio: "inherit",
      shell: true
    }
  );
}

function writeSummary(result) {
  const payload = {
    ok: result.status === 0,
    lane: "browser-smoke-e2e",
    command: "pnpm exec playwright test --config e2e/smoke/playwright.config.mjs",
    reportPath: path.join("e2e", "smoke", "artifacts", "playwright-report.json"),
    outputDir: path.join("e2e", "smoke", "artifacts", "test-output"),
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync(SUMMARY_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return payload;
}

function main() {
  ensureCleanArtifactsDir();
  const result = runPlaywrightSmoke();
  const summary = writeSummary(result);
  console.log(JSON.stringify(summary, null, 2));

  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
  }
}

main();
