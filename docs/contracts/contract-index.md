# Contract Index

## Purpose
- Define the active delivery contracts and the exact machine-read artifacts used by quality and runtime checks.

## Active Contracts
1. `docs/contracts/delivery-scope-contract.md`
2. `docs/contracts/quality-gate-contract.md`

## Active Artifacts
1. `docs/contracts/artifacts/server-lane-manifest-v1.json`
2. `docs/contracts/artifacts/frontend-lane-manifest-v1.json`
3. `docs/contracts/artifacts/module-id-alias-map-v1.json`
4. `docs/contracts/artifacts/deterministic-replay-results.json`

## Contract Usage
- `scripts/protocol-integrity-check.mjs` verifies that all active contracts and artifacts exist and are referenced here.
- `scripts/quality-gate.mjs` enforces delivery checks and executes runtime/test verification lanes.

