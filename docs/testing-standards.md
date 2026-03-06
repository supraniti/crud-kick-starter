# Testing Standards

## Status
- Supplemental detail for testing policy depth.
- Canonical baseline is `docs/core-standards.md`.

## Purpose
- Enforce evidence-based delivery and keep regressions from reaching closure.

## Scope
- Applies to all executable changes and verification decisions.
- Documentation-only changes are explicitly excluded from automated test execution.

## Change-Type Policy
1. `executable-change`: run relevant automated lanes before closure.
2. `documentation-only`: record explicit note `Tests not run (documentation-only change).`
3. If uncertain, classify as `executable-change`.

## Required Test Layers
1. Contract tests for changed boundaries.
2. Unit tests for extracted or newly introduced logic.
3. Integration tests for end-to-end behavior in touched flows.
4. Regression tests for fixed defects.
5. When logic is extracted for reuse, tests must cover:
  - shared boundary behavior
  - at least one consumer integration path

## Lane Selection Rule
1. Run targeted lanes during implementation slices.
2. Run closure lanes before pass decision.
3. Keep lane list explicit in `handoff.md` notes.

## Failure Triage Standard
1. Do not loop blindly on retries.
2. Reproduce failure deterministically.
3. Identify root cause and record it in review/findings.
4. Add or update regression coverage before closure.

## Evidence Requirements
1. Record command lanes executed.
2. Record pass/fail outcomes with key counts where available.
3. Record unresolved findings and disposition.
4. Keep evidence in `handoff.md`.
5. Record duplication-check outcome for executable slices.
