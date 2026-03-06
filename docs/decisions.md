# Decisions

## Purpose
- Keep only active directional decisions that affect execution behavior.

## Active Decisions
1. Date: 2026-03-06
   - Decision: `handoff.md` is the single live progress pointer.
   - Impact: eliminates split-state drift between multiple handoff files.

2. Date: 2026-03-06
   - Decision: active contracts live under `docs/contracts/` and are enforced by `pnpm quality:protocol`.
   - Impact: quality gate and docs pointers stay synchronized.

3. Date: 2026-03-06
   - Decision: capability expansion is module-first by default.
   - Impact: minimum core edits, maximum bounded module additions.

4. Date: 2026-03-06
   - Decision: command execution source of truth is `docs/command-registry.md`.
   - Impact: fresh agents avoid command discovery drift.
