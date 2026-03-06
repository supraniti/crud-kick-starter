# Delivery Scope Contract

## Objective
- Keep the repository delivery-ready with only active runtime, tests, and docs.

## Included Delivery Surfaces
- `server/`
- `frontend/`
- `modules/`
- `e2e/`
- `scripts/`
- `docs/contracts/`

## Exclusion Rules
- Archive-only folders are not allowed in active delivery scope.
- Historical protocol trees are not allowed in active delivery scope.
- Any artifact without active runtime/test/contract usage must be removed.

## Module Scope
- Active module surface is limited to:
  - `modules/test-modules-crud-core`
  - `modules/test-modules-relations-taxonomy`
  - `modules/test-modules-settings-policy`
  - `modules/test-modules-operations-dispatch`
  - `modules/test-modules-remotes-publish`
