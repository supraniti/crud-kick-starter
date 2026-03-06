# Core 12 Standards

## Purpose
- Define the smallest enforceable standards set for speed, maintainability, agentability, readability, and quality.

## How To Use
- This is the canonical standards file.
- Implementer and verifier evaluate all 12 rules on each executable slice.
- `pass` requires no unresolved block condition.

## Core 12 Checklist
1. **Bounded Scope**
   - Each slice is single-purpose and tied to active request intent.
2. **Small, Reviewable Diffs**
   - Avoid mixed-purpose mega-diffs; split by concern where practical.
3. **Anti-Monolith Budget**
   - Code soft/hard limits: `350/600` lines.
   - Generated code hard limit: `900` lines with reduction plan.
4. **Boundary Integrity**
   - No cross-layer shortcuts or hidden coupling across ownership boundaries.
5. **Predictable Structure**
   - Stable folder conventions and role-oriented naming.
6. **Shared Primitive Discipline**
   - Repeated logic across modules is promoted to shared reusable boundaries.
   - No third-copy rule: if similar logic already exists in two places, a third copy is blocked unless waived.
7. **Explicit Change Classification**
   - Every slice is marked `executable-change` or `documentation-only`.
8. **Targeted Test Lanes During Implementation**
   - Run changed-boundary contract/unit/integration lanes while building.
9. **Closure Lane Replay**
   - Run required closure lanes before pass decision.
10. **Failure Triage Over Blind Retry**
   - Reproduce, root-cause, then fix + regression coverage.
11. **Flake Control**
   - Treat flaky tests as defects; no silent rerun-only closure.
12. **Periodic Drift Check**
   - Run deep observer analysis every 10 execution steps (or earlier on trigger).

## Block Conditions
1. Hard-limit breach without allowlist decision and retirement plan.
2. Missing required test evidence for executable changes.
3. Unresolved critical/high findings in changed boundaries.
4. Claimed closure without reproducible verification.
5. Analysis trigger fired but mitigation not recorded.
6. Third-copy duplication introduced without approved waiver and retirement plan.
7. Duplication check not executed (or manual substitute not recorded) for executable slices.

## Enforcement Inputs
- `docs/agent-contracts.md`
- `docs/analysis-loop.md`
- `docs/command-registry.md`
- `docs/coding-standards.md`
- `handoff.md`
- `docs/contracts/contract-index.md`
