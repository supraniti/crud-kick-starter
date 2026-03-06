# First Agent Init Prompt

## Copy/Paste Prompt
Use this as the very first prompt for an agent entering a new repository:

```text
Initialize this repository for deterministic delivery execution.

Goals:
1) Discover and set canonical commands for lint, typecheck, targeted tests, full tests, build, and quality gate.
2) Discover and set canonical duplication-check command.
3) Discover and set common-ops slots (dev server/frontend command, app URL, default ports-to-clear).
4) Record them in docs/command-registry.md.
5) Export them in current shell/session environment for this run.
6) Validate each command at least once (or record exact blocker).

Required outputs:
1) Updated docs/command-registry.md with concrete commands.
2) A short execution summary with pass/fail status per command.
3) Any missing-tool/blocker list with next action.

Command slot names:
- LINT_CMD
- TYPECHECK_CMD
- TEST_FAST_CMD
- TEST_FULL_CMD
- BUILD_CMD
- QUALITY_GATE_CMD
- DUPLICATION_CHECK_CMD
- DEV_SERVER_CMD
- DEV_FRONTEND_CMD
- APP_URL
- PORTS_TO_CLEAR

Discovery policy:
1) Prefer repository-native scripts first.
2) Prefer workspace package manager lockfile owner (pnpm > npm when pnpm-lock exists).
3) Use deterministic non-watch commands only.
4) If command is unavailable, set slot to N/A and explain.

Selection hints by stack:
- Node/TS: package.json scripts (lint, typecheck, test, build, quality:gate or equivalent)
- Python: ruff/flake8, mypy/pyright, pytest, build
- Go: golangci-lint/go vet, go test ./..., go build ./...
- Mixed repo: define commands per active boundary and keep QUALITY_GATE_CMD as aggregate command.
- Duplication tools: jscpd, dupl, or equivalent deterministic scanner; if unavailable, define a manual scan command and note limitations.

After selection:
1) Update docs/command-registry.md.
2) Export env vars for this session:
   - LINT_CMD
   - TYPECHECK_CMD
   - TEST_FAST_CMD
   - TEST_FULL_CMD
   - BUILD_CMD
   - QUALITY_GATE_CMD
   - DUPLICATION_CHECK_CMD
   - DEV_SERVER_CMD
   - DEV_FRONTEND_CMD
   - APP_URL
   - PORTS_TO_CLEAR
3) Run and report:
   - $LINT_CMD
   - $TYPECHECK_CMD
   - $DUPLICATION_CHECK_CMD
   - $TEST_FAST_CMD
   - $BUILD_CMD
4) If all green, run:
   - $QUALITY_GATE_CMD (or $TEST_FULL_CMD if no aggregate gate exists)
```

## Operational Rule
- During implementation, use:
  - targeted lanes for inner-loop speed (`TEST_FAST_CMD`)
  - duplication scan during code shaping (`DUPLICATION_CHECK_CMD`)
  - full gate at closure (`QUALITY_GATE_CMD` or `TEST_FULL_CMD`)
- During local ops/debug, use:
  - `DEV_SERVER_CMD`, `DEV_FRONTEND_CMD`, `APP_URL`, `PORTS_TO_CLEAR`
