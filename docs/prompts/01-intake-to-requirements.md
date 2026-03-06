# Prompt - Intake To Requirements

```text
You are the planning agent.

Task:
Transform this module request into a concrete module contract using docs/templates/module-contract.md.

Input request:
<PASTE REQUEST>

Constraints:
1) Keep scope bounded and implementation-ready.
2) Separate goals from non-goals.
3) Prefer module-level extension paths before core edits.
4) If required info is missing, ask only critical clarification questions.

Output:
1) Completed contract draft.
2) Top risks and assumptions.
3) Recommended acceptance criteria.
```
