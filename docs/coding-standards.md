# Coding Standards

## Status

- Supplemental detail for coding-specific policy depth.
- Canonical baseline is `docs/core-standards.md`.

## Purpose

- Keep implementation quality high and prevent codebase bloat, monolith files, and boundary drift.

## Scope

- Applies to all executable code and generated artifacts committed to this repository.
- Applies to both implementer and verifier roles.

## Canonical Rules

1. One responsibility per file.
2. Prefer composition modules over large orchestration files.
3. Preserve explicit boundary ownership (no cross-layer shortcuts).
4. Prefer deterministic behavior over hidden fallback behavior.
5. Keep naming and folder structure predictable.
6. Reuse before new code: search for existing equivalent logic before adding a new implementation.
7. No third copy rule: when similar logic exists in two places, extract shared boundary instead of adding a third copy.

## File Size Budgets

1. Code soft limit: `350` lines.
2. Code hard limit: `600` lines.
3. Generated code hard limit: `900` lines (temporary; add reduction note in milestone file).
4. Any hard-limit breach requires explicit decision entry and retirement plan.

## Folder And Boundary Rules

1. Core boundary files should remain thin orchestration surfaces.
2. Domain logic should live in focused helper modules under a domain folder.
3. Avoid importing module-local implementation details into unrelated domains.
4. New shared primitives must be reusable and neutral (not product-module-specific by default).

## Naming Conventions

1. Folders: `kebab-case`.
2. Files: descriptive role-oriented names (for example `route-view-contract.js`, `value-normalization.js`).
3. Tests: mirror target domain and include intent (`*.contract.*`, `*.integration.*`, `*.unit.*`).

## Complexity And Refactor Triggers

1. Trigger refactor when file crosses soft limit and continues growing.
2. Trigger refactor when one file owns multiple unrelated concerns.
3. Trigger refactor when repeated conditional branching appears for each new capability type.
4. Trigger refactor when a shared rule is duplicated across two or more modules.

## Reuse Enforcement Procedure

1. Pre-implementation scan:

- run duplication scan command from `docs/command-registry.md` (`DUPLICATION_CHECK_CMD`) or document manual equivalent.

2. During implementation:

- if duplicate logic is detected, prefer extraction to shared helper/primitive in the same slice.

3. Post-implementation check:

- re-run duplication scan and record result in milestone evidence.

4. Waiver path:

- if extraction is intentionally deferred, add decision entry with:
  - scope
  - reason
  - expiry milestone
  - retirement owner

## Change Discipline

1. Keep diffs scoped to active step boundaries.
2. Avoid mixed-purpose mega-diffs.
3. Record structural extractions in milestone implementation log.

## Review Block Conditions

1. Hard-limit breaches without explicit allowlist decision.
2. New monolithic files where decomposition is feasible.
3. Cross-boundary coupling that violates architecture ownership.
4. Silent behavior changes without corresponding verification evidence.
5. Third-copy duplication introduced without waiver.
6. Duplication check missing from executable-slice evidence.
