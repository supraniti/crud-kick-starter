import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_PROOF_PATH = path.resolve(
  process.cwd(),
  "docs",
  "contracts",
  "artifacts",
  "deterministic-replay-results.json"
);

function parseArgs(argv) {
  const parsed = {
    proofPath: DEFAULT_PROOF_PATH
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--path") {
      const value = argv[index + 1] ?? "";
      if (typeof value === "string" && value.trim().length > 0) {
        parsed.proofPath = path.resolve(process.cwd(), value.trim());
      }
      index += 1;
    }
  }

  return parsed;
}

async function readProofFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return {
      ok: true,
      value: JSON.parse(raw)
    };
  } catch (error) {
    return {
      ok: false,
      error
    };
  }
}

function findReplayProof(replays, replayName) {
  if (!Array.isArray(replays)) {
    return null;
  }
  return replays.find((entry) => entry?.name === replayName) ?? null;
}

function buildFailure(code, message, context = {}) {
  return {
    ok: false,
    code,
    message,
    context,
    timestamp: new Date().toISOString()
  };
}

function printAndExit(payload, exitCode) {
  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = exitCode;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const proofRead = await readProofFile(args.proofPath);
  if (!proofRead.ok) {
    printAndExit(
      buildFailure(
        "MISSION_REPLAY_PROOF_MISSING",
        "Mission replay proof file is missing or unreadable",
        {
          proofPath: args.proofPath,
          errorMessage: proofRead.error?.message ?? "Unknown read failure"
        }
      ),
      1
    );
    return;
  }

  const proof = proofRead.value;
  if (!proof || typeof proof !== "object") {
    printAndExit(
      buildFailure("MISSION_REPLAY_PROOF_INVALID", "Mission replay proof must be a JSON object", {
        proofPath: args.proofPath
      }),
      1
    );
    return;
  }

  const passA = findReplayProof(proof.replays, "pass-a-reference-parity");
  const passB = findReplayProof(proof.replays, "pass-b-mutation-stress");
  const passAOk = passA?.deterministic === true;
  const passBOk = passB?.deterministic === true;
  const rootOk = proof.ok === true;

  if (!rootOk || !passAOk || !passBOk) {
    printAndExit(
      buildFailure(
        "MISSION_REPLAY_GATE_FAILED",
        "Replay proof exists but deterministic gate requirements are not satisfied",
        {
          proofPath: args.proofPath,
          rootOk,
          passAOk,
          passBOk
        }
      ),
      1
    );
    return;
  }

  printAndExit(
    {
      ok: true,
      gate: "mission-replay",
      proofPath: args.proofPath,
      checks: {
        rootOk,
        passAOk,
        passBOk
      },
      timestamp: new Date().toISOString()
    },
    0
  );
}

run().catch((error) => {
  printAndExit(
    buildFailure("MISSION_REPLAY_GATE_RUNTIME_ERROR", "Unexpected replay gate runtime failure", {
      errorMessage: error?.message ?? "Unknown runtime error"
    }),
    1
  );
});
