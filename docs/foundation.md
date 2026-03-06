# Foundation

## Purpose
- Define the minimum delivery protocol for high-throughput, low-drift execution.

## Non-Negotiables
1. Contract-first before implementation.
2. Module-first extension before core edits.
3. Evidence-based closure through executable verification lanes.
4. No silent scope drift.
5. Keep active docs current and lean.

## Core Procedures
1. Role boundaries follow `docs/agent-contracts.md`.
2. Core implementation/review rules follow `docs/core-standards.md`.
3. Commands are sourced from `docs/command-registry.md`.
4. Recurring execution routines use `docs/common-tasks.md`.
5. Progress pointer is `handoff.md`.
6. Delivery contracts are under `docs/contracts/`.

## Change Classification
- `executable-change`: runtime behavior changed; run applicable lanes.
- `documentation-only`: docs/process only; record explicit test-skip note.

## Minimum Closure Checks
1. Scope and acceptance intent are explicit.
2. Required verification lanes are green.
3. No unresolved critical/high findings in changed boundaries.
4. `handoff.md` reflects the real stop point and next action.
5. Contract and command pointers remain valid.
