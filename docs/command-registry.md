# Command Registry

## Purpose
- Keep one canonical command map for lint, test, build, and quality verification.

## Status
- Last updated: 2026-03-06
- Owner: delivery-maintenance
- Confidence: verified against current repo scripts

## Command Slots
- `LINT_CMD` = `pnpm lint:repo-loc && pnpm lint:function-shape`
- `TYPECHECK_CMD` = `N/A (no standalone typecheck lane in this repo)`
- `TEST_FAST_CMD` = `pnpm quality:gate`
- `TEST_FULL_CMD` = `pnpm quality:gate:full`
- `BUILD_CMD` = `pnpm --filter frontend build`
- `QUALITY_GATE_CMD` = `pnpm quality:gate:full`
- `DUPLICATION_CHECK_CMD` = `N/A (no dedicated duplication scanner; enforce via lint/function-shape + review)`
- `DEV_SERVER_CMD` = `pnpm dev:server`
- `DEV_FRONTEND_CMD` = `pnpm dev:frontend`
- `APP_URL` = `http://127.0.0.1:5173`
- `PORTS_TO_CLEAR` = `5173,3000,3001`
