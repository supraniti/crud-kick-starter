# Quality Gate Contract

## Objective
- Ensure delivery safety through active checks only.

## Active Gate Profiles
- `dev-fast`: repo/function lint, contract integrity, server core+conformance, frontend core+conformance.
- `pr-standard`: `dev-fast` plus server runtime integration and frontend integration.
- `release-full`: `pr-standard` plus e2e smoke, api runners (`deployment-mission-policy`, `editorial-capability`), frontend build, and mission replay gate.

## Active Artifact Bindings
- Dynamic lane selection uses:
  - `docs/contracts/artifacts/server-lane-manifest-v1.json`
  - `docs/contracts/artifacts/frontend-lane-manifest-v1.json`
- Module-id translation uses:
  - `docs/contracts/artifacts/module-id-alias-map-v1.json`
- Mission replay gate proof uses:
  - `docs/contracts/artifacts/deterministic-replay-results.json`

## Contract Integrity Binding
- `scripts/protocol-integrity-check.mjs` must pass for `quality:gate` and `quality:gate:full`.


