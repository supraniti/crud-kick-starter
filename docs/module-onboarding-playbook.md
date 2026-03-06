# Module Onboarding Playbook

## Purpose
- Convert a business request into a shippable module with consistent speed and quality.

## Input
- Business brief in plain language (for example: "Add article support with taxonomy and authors").

## Delivery Flow
1. Intake And Clarification
  - produce clarified problem statement and non-goals.
  - output: module contract draft.
2. Contract Finalization
  - lock data model, UI flows, settings/actions, acceptance criteria, and risk tier.
  - output: approved module contract.
3. Plan Slice
  - convert contract to bounded implementation slices and required lanes.
4. Implementation
  - implement module-owned behavior first; prefer reuse over duplication.
5. Verification
  - run required lanes from `docs/command-registry.md`.
6. Review
  - independent verifier pass with findings ordered by severity.
7. Closure And Handoff
  - update `handoff.md` with outcome and next step.

## Extension Order (Mandatory)
1. Level 1: manifest/schema declaration.
2. Level 2: module-local adapters.
3. Level 3: shared primitive extraction.
4. Level 4: core edit only by explicit waiver.

## Fast-Fail Triggers
1. Repeated gate failures in same boundary.
2. Third-copy duplication event.
3. Missing acceptance criteria clarity.
4. Drift from module-first extension order.

## Minimum Completion Signal
1. Module behavior works in UI/runtime paths.
2. Required verification lanes are green.
3. No unresolved critical/high findings.
4. `handoff.md` is accurate for fresh-agent continuation.
