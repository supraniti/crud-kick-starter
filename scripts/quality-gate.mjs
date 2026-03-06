import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_TRANSLATION_MODE =
  (process.env.REFERENCE_MODULE_ID_TRANSLATION_MODE || "").trim() || "dual-compat";

function getDynamicLaneEnv() {
  return {
    REFERENCE_MODULE_ID_TRANSLATION_MODE: DEFAULT_TRANSLATION_MODE
  };
}

const STEP_CATALOG = {
  "lint-repo-loc-max-600": {
    id: "lint-repo-loc-max-600",
    command: "pnpm",
    args: ["lint:repo-loc"]
  },
  "lint-function-shape-maxima": {
    id: "lint-function-shape-maxima",
    command: "pnpm",
    args: ["lint:function-shape"]
  },
  "lane-server-core": {
    id: "lane-server-core",
    command: "pnpm",
    args: ["test:server:core"]
  },
  "lane-server-conformance": {
    id: "lane-server-conformance",
    command: "pnpm",
    args: ["test:server:conformance:dynamic"],
    env: getDynamicLaneEnv()
  },
  "lane-server-runtime-integration": {
    id: "lane-server-runtime-integration",
    command: "pnpm",
    args: ["test:server:runtime-integration:dynamic"],
    env: getDynamicLaneEnv()
  },
  "lane-frontend-core": {
    id: "lane-frontend-core",
    command: "pnpm",
    args: ["test:frontend:core"]
  },
  "lane-frontend-conformance": {
    id: "lane-frontend-conformance",
    command: "pnpm",
    args: ["test:frontend:conformance:dynamic"],
    env: getDynamicLaneEnv()
  },
  "lane-frontend-integration": {
    id: "lane-frontend-integration",
    command: "pnpm",
    args: ["test:frontend:integration:dynamic"],
    env: getDynamicLaneEnv()
  },
  "protocol-integrity": {
    id: "protocol-integrity",
    command: "node",
    args: ["scripts/protocol-integrity-check.mjs"]
  },
  "lane-e2e-smoke": {
    id: "lane-e2e-smoke",
    command: "pnpm",
    args: ["test:e2e:smoke"]
  },
  "m22-api-runner": {
    id: "m22-api-runner",
    command: "pnpm",
    args: ["api-runner:m22", "--", "--no-write-reports"],
    env: getDynamicLaneEnv()
  },
  "m26-api-runner": {
    id: "m26-api-runner",
    command: "pnpm",
    args: ["api-runner:m26", "--", "--no-write-reports"],
    env: getDynamicLaneEnv()
  },
  "frontend-build": {
    id: "frontend-build",
    command: "pnpm",
    args: ["--filter", "frontend", "build"]
  },
  "mission-replay-gate": {
    id: "mission-replay-gate",
    command: "pnpm",
    args: ["mission:replay-gate"]
  }
};

const PROFILE_STEP_IDS = {
  "dev-fast": [
    "lint-repo-loc-max-600",
    "lint-function-shape-maxima",
    "protocol-integrity",
    "lane-server-core",
    "lane-server-conformance",
    "lane-frontend-core",
    "lane-frontend-conformance"
  ],
  "pr-standard": [
    "lint-repo-loc-max-600",
    "lint-function-shape-maxima",
    "protocol-integrity",
    "lane-server-core",
    "lane-server-conformance",
    "lane-server-runtime-integration",
    "lane-frontend-core",
    "lane-frontend-conformance",
    "lane-frontend-integration"
  ],
  "release-full": [
    "lint-repo-loc-max-600",
    "lint-function-shape-maxima",
    "protocol-integrity",
    "lane-server-core",
    "lane-server-conformance",
    "lane-server-runtime-integration",
    "lane-frontend-core",
    "lane-frontend-conformance",
    "lane-frontend-integration",
    "lane-e2e-smoke",
    "m22-api-runner",
    "m26-api-runner",
    "frontend-build",
    "mission-replay-gate"
  ]
};

export const PROFILE_IDS = Object.keys(PROFILE_STEP_IDS);

export function getStepsForProfile(profileId) {
  const stepIds = PROFILE_STEP_IDS[profileId];
  if (!stepIds) {
    throw new Error(
      `[quality:gate] invalid profile '${profileId}'. Expected one of: ${PROFILE_IDS.join(", ")}`
    );
  }

  return stepIds.map((stepId) => {
    const step = STEP_CATALOG[stepId];
    if (!step) {
      throw new Error(`[quality:gate] missing step catalog entry for '${stepId}'`);
    }
    return step;
  });
}

export function validateProfileSteps(profileId) {
  const steps = getStepsForProfile(profileId);
  const duplicateStepIds = [];
  const duplicateCommands = [];
  const seenStepIds = new Set();
  const seenCommandKeys = new Map();

  for (const step of steps) {
    if (seenStepIds.has(step.id)) {
      duplicateStepIds.push(step.id);
    } else {
      seenStepIds.add(step.id);
    }

    const commandKey = `${step.command} ${step.args.join(" ")}`.trim();
    if (seenCommandKeys.has(commandKey)) {
      duplicateCommands.push({
        commandKey,
        firstStepId: seenCommandKeys.get(commandKey),
        duplicateStepId: step.id
      });
    } else {
      seenCommandKeys.set(commandKey, step.id);
    }
  }

  return {
    ok: duplicateStepIds.length === 0 && duplicateCommands.length === 0,
    profileId,
    duplicateStepIds,
    duplicateCommands,
    stepCount: steps.length
  };
}

export function resolveProfileId(argv) {
  if (argv.includes("--full")) {
    return "release-full";
  }
  if (argv.includes("--pr")) {
    return "pr-standard";
  }

  const profileArg = argv.find((value) => String(value).startsWith("--profile="));
  if (profileArg) {
    return profileArg.slice("--profile=".length).trim();
  }

  return "dev-fast";
}

function runStep(step) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(step.command, step.args, {
      stdio: "inherit",
      shell: true,
      env: {
        ...process.env,
        ...(step.env || {})
      }
    });

    child.on("close", (code) => {
      resolve({
        ...step,
        ok: code === 0,
        exitCode: code ?? 1,
        durationMs: Date.now() - startedAt
      });
    });
  });
}

async function run() {
  const profileId = resolveProfileId(process.argv.slice(2));
  const noDupValidation = validateProfileSteps(profileId);

  if (!noDupValidation.ok) {
    const summary = {
      ok: false,
      mode: profileId,
      reason: "DUPLICATE_STEP_DETECTED",
      duplicateStepIds: noDupValidation.duplicateStepIds,
      duplicateCommands: noDupValidation.duplicateCommands,
      timestamp: new Date().toISOString()
    };
    console.log("\n[quality:gate] Gate failed.");
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = 1;
    return;
  }

  const steps = getStepsForProfile(profileId);
  const results = [];

  for (const step of steps) {
    console.log(`\n[quality:gate] Running step '${step.id}'...`);
    const result = await runStep(step);
    results.push(result);

    if (!result.ok) {
      const summary = {
        ok: false,
        mode: profileId,
        failedStep: step.id,
        results,
        timestamp: new Date().toISOString()
      };
      console.log("\n[quality:gate] Gate failed.");
      console.log(JSON.stringify(summary, null, 2));
      process.exitCode = result.exitCode;
      return;
    }
  }

  const summary = {
    ok: true,
    mode: profileId,
    results,
    timestamp: new Date().toISOString()
  };
  console.log("\n[quality:gate] Gate passed.");
  console.log(JSON.stringify(summary, null, 2));
}

const isMainModule = (() => {
  if (!process.argv[1]) {
    return false;
  }
  const entryHref = pathToFileURL(path.resolve(process.argv[1])).href;
  return import.meta.url === entryHref;
})();

if (isMainModule) {
  run();
}
