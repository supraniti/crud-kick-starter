# Crud Kick Starter

## What It Is
Crud Kick Starter is a ready-to-fork foundation for teams that need to build data-heavy systems quickly without losing control of quality.

It ships with a working server, frontend, module runtime, and quality lanes that already agree on how new capability should be added.

## Built For
- Teams building CMS, admin, operations, and internal data platforms.
- Product owners who describe requirements in business language and want fast execution.
- Developers who want module-first extension instead of risky core rewrites.

## Why It Saves Agent Time And Tokens
- Module-first delivery keeps most changes inside bounded module surfaces.
- Contracts and command registry reduce repeated discovery prompts.
- One active handoff pointer keeps continuation context compact.
- Lane manifests map tests to capability lanes, so agents run what matters while building.

## Benefits
- Faster onboarding of new data capabilities.
- Lower regression risk through enforced quality gates.
- Predictable naming and folder structure for both humans and agents.
- Clean active scope with no archive/protocol clutter in runtime delivery paths.

## How To Use
1. Fork this repository.
2. Install dependencies: `pnpm install`.
3. Read `handoff.md` and `docs/contracts/contract-index.md`.
4. Define the requested capability and extend modules first.
5. Run `pnpm quality:gate:full` before merge.

## Example Requests
- "Add support to article data type with taxonomies and authors."
- "Add moderation workflow with role-based review states."
- "Add publish queue actions and status dashboard for editors."

## Working Contract
- Progress pointer: `handoff.md`
- Delivery scope contract: `docs/contracts/delivery-scope-contract.md`
- Quality gate contract: `docs/contracts/quality-gate-contract.md`
- Command map: `docs/command-registry.md`
- Module execution playbook: `docs/module-onboarding-playbook.md`
