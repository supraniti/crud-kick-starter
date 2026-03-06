# Analysis Loop

## Purpose
- Add a periodic truth-check layer that catches drift early.

## Cadence
1. Run one deep analysis checkpoint every 10 execution steps.
2. Run earlier if trigger conditions are hit.

## Trigger Conditions
1. Two consecutive failed quality-gate runs.
2. Repeated regression in the same boundary.
3. High-severity lock-in risk.
4. Material scope shift from accepted intent.

## Required Inputs
1. `handoff.md`
2. `docs/contracts/contract-index.md`
3. `docs/command-registry.md`
4. Runtime/test evidence from the active window.

## Required Outputs
1. Checkpoint summary appended in `handoff.md` notes.
2. Prioritized directives for next slice.
3. Decision update only when direction changes.
