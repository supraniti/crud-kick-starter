# North Star

## Purpose
- Define the measurable success target for this docs/repo system as a CMS kick-starter.

## Kick-Starter Mission
- Enable fast, reliable onboarding of new business modules (for example: articles, products, tickets) on top of shared server/frontend/module-runtime foundations.
- Optimize for reuse and extension, not one-off feature implementation.

## End-State Definition
- A new module can be delivered from business brief to working CRUD/UI/runtime behavior through mostly module-owned inputs and bounded extensions.

## Success Metrics (Primary)
1. Time-to-first-working-module:
  - target: first functional module implementation in <= 1 delivery milestone.
2. Core-edit rate:
  - target: >= 70% of new modules delivered with zero level-4 core edits.
3. First-pass closure quality:
  - target: >= 80% of milestones close without reopening due to critical/high findings.
4. Reuse progression:
  - target: no unwaived third-copy duplication events.
5. Onboarding fidelity:
  - target: module onboarding runbook can be replayed by a fresh agent without hidden context.

## Capability Dimensions (Scored 0-2)
1. Zero-core onboarding depth.
2. Behavior ownership depth (manifest/module/shared primitives).
3. CRUD/runtime/UI completeness.
4. Module settings/actions/jobs/remotes integration.
5. Determinism and regression resistance under expansion.
6. Reuse and decomposition health.

## Guardrails
1. Feature count is not a success metric by itself.
2. Temporary proof modules do not count as closure unless shared boundaries improve.
3. Level-4 core edits require explicit waiver and retirement plan.
4. Documentation claims do not replace runtime/test evidence.

## Core Edit Waiver Protocol
- Required fields:
  - reason level-1/2/3 extension was insufficient
  - exact changed core boundary
  - mitigation and rollback strategy
  - retirement milestone
  - owner

## Measurement Cadence
1. Per execution slice:
  - track evidence in active milestone file.
2. Every 10 execution steps:
  - run analysis checkpoint per `docs/analysis-loop.md`.
3. Milestone closure:
  - update score snapshot and decisions if direction changed.
