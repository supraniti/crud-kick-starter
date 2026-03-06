# Modules Workspace

This directory contains the active non-production module set used by runtime and test lanes.

Active modules:
- `modules/test-modules-crud-core`
- `modules/test-modules-relations-taxonomy`
- `modules/test-modules-settings-policy`
- `modules/test-modules-operations-dispatch`
- `modules/test-modules-remotes-publish`

Contract reference:
- `docs/contracts/delivery-scope-contract.md`

Runtime surfaces:
- module discovery and navigation via `GET /api/reference/modules`
- runtime diagnostics via `GET /api/reference/modules/runtime`
- collection schema and CRUD registration via `GET /api/reference/collections`
