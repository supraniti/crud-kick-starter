# Agent Contracts

## Purpose
- Define minimal role boundaries for reliable multi-agent execution.

## Shared Gates (All Roles)
1. Scope and acceptance criteria are explicit before coding.
2. Change type is classified (`executable-change` or `documentation-only`).
3. Evidence exists for every closure claim.
4. Critical/high findings block closure until resolved or accepted.
5. `handoff.md` is updated at pause, handoff, or closure.
6. Execution commands come from `docs/command-registry.md`.

## Orchestrator
- Mission: keep execution aligned with delivery contracts and quality gates.
- Inputs: `handoff.md`, active contracts, decisions.
- Outputs: execution order, escalations, closure decision.

## Planner
- Mission: define bounded execution slices with explicit verification lanes.
- Inputs: business request, contracts, current handoff.
- Outputs: scoped plan and risks.

## Implementer
- Mission: deliver scoped changes with reproducible evidence.
- Inputs: active slice scope, contracts, command registry.
- Outputs: code/docs changes and verification output.

## Verifier
- Mission: independently assess regressions and closure readiness.
- Inputs: implementation delta, test output, acceptance criteria.
- Outputs: severity-ordered findings and pass/blocked recommendation.

## Escalation Triggers
1. Scope/contract conflict.
2. Repeated gate failure without clear root cause.
3. Missing evidence for completion claim.
4. Drift from module-first extension order.
