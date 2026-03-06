# Browser Smoke E2E Lane

Real browser-backed smoke lane implemented for Phase 4 closeout.

## Scope
- lane: `browser-smoke-e2e`
- runner: Playwright (`@playwright/test`)
- command: `pnpm test:e2e:smoke`
- specs: `e2e/smoke/specs/app-smoke.spec.mjs`

## Covered Flows
1. shell/auth to workspace load.
2. active-route module CRUD (remotes create/delete).
3. mission/job run to terminal success state.

## Deterministic Artifacts
- JSON report: `e2e/smoke/artifacts/playwright-report.json`
- runner summary: `e2e/smoke/artifacts/last-run-summary.json`
- failure artifacts: `e2e/smoke/artifacts/test-output/` (screenshots/traces retained on failure)
