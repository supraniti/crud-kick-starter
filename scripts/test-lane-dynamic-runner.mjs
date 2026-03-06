import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getLaneFileList } from "./test-lane-manifest-files.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(SCRIPT_PATH), "..");

function parseArgs(argv) {
  const args = {
    target: null,
    laneGroup: "conformance"
  };
  for (const rawArg of argv) {
    const arg = String(rawArg);
    if (arg.startsWith("--target=")) {
      args.target = arg.slice("--target=".length).trim();
      continue;
    }
    if (arg.startsWith("--lane-group=")) {
      args.laneGroup = arg.slice("--lane-group=".length).trim() || args.laneGroup;
      continue;
    }
  }
  return args;
}

function runCommand(command, args) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: true
    });
    child.on("close", (code) => {
      resolve({
        ok: code === 0,
        exitCode: code ?? 1,
        durationMs: Date.now() - startedAt
      });
    });
  });
}

function normalizeTargetAndLaneGroup(args) {
  if (!args.target || (args.target !== "server" && args.target !== "frontend")) {
    return {
      ok: false,
      message: "Missing or invalid --target. Use --target=server or --target=frontend."
    };
  }

  const isServerTarget = args.target === "server";
  const allowedLaneGroups = isServerTarget
    ? new Set(["core", "conformance", "runtime", "runtime-integration"])
    : new Set(["core", "conformance", "integration"]);
  if (!allowedLaneGroups.has(args.laneGroup)) {
    const usage = isServerTarget
      ? "--lane-group=core|conformance|runtime|runtime-integration"
      : "--lane-group=core|conformance|integration";

    return {
      ok: false,
      message: `Missing or invalid --lane-group. Use ${usage}.`
    };
  }

  if (isServerTarget && args.laneGroup === "runtime") {
    args.laneGroup = "runtime-integration";
  }

  return {
    ok: true
  };
}

function resolveSelectedManifestFiles(args) {
  const selectedManifestFiles = getLaneFileList(args.target, args.laneGroup);
  if (selectedManifestFiles.length > 0) {
    return {
      ok: true,
      selectedManifestFiles
    };
  }

  return {
    ok: false,
    payload: {
      ok: false,
      reason: "no lane-owned files selected from manifest for target/lane-group",
      target: args.target,
      laneGroup: args.laneGroup
    }
  };
}

function ensureSelectedManifestFilesExist(args, selectedManifestFiles) {
  for (const filePath of selectedManifestFiles) {
    const absolutePath = path.join(ROOT_DIR, filePath);
    if (!fs.existsSync(absolutePath)) {
      return {
        ok: false,
        payload: {
          ok: false,
          reason: "manifest-selected test file does not exist",
          target: args.target,
          testFilePath: filePath
        }
      };
    }
  }

  return {
    ok: true
  };
}

function toRunFileArgs(args, selectedManifestFiles) {
  return selectedManifestFiles.map((filePath) => {
    if (args.target === "server" && filePath.startsWith("server/")) {
      return filePath.slice("server/".length);
    }
    if (args.target === "frontend" && filePath.startsWith("frontend/")) {
      return filePath.slice("frontend/".length);
    }
    return filePath;
  });
}

function buildRunArgs(args, runFileArgs) {
  if (args.target === "server") {
    const serverRunArgs = [
      "--filter",
      "server",
      "exec",
      "vitest",
      "run",
      "--pool=threads",
      "--testTimeout=60000",
      "--hookTimeout=60000"
    ];

    // Runtime integration includes live infra mutation tests (start/stop/restart Mongo),
    // so keep execution single-worker to avoid cross-test interference.
    if (args.laneGroup === "runtime-integration") {
      serverRunArgs.push("--maxWorkers=1");
    }

    return [
      ...serverRunArgs,
      ...runFileArgs
    ];
  }

  return ["--filter", "frontend", "exec", "vitest", "run", ...runFileArgs];
}

function printJsonAndExit(payload, exitCode) {
  if (payload) {
    const output = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
    console.error(output);
  }
  process.exit(exitCode);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const targetValidation = normalizeTargetAndLaneGroup(args);
  if (!targetValidation.ok) {
    console.error(targetValidation.message);
    process.exit(1);
    return;
  }

  const selectedFileResult = resolveSelectedManifestFiles(args);
  if (!selectedFileResult.ok) {
    printJsonAndExit(selectedFileResult.payload, 1);
    return;
  }

  const selectedManifestFiles = selectedFileResult.selectedManifestFiles;
  const fileExistence = ensureSelectedManifestFilesExist(args, selectedManifestFiles);
  if (!fileExistence.ok) {
    printJsonAndExit(fileExistence.payload, 1);
    return;
  }

  const runFileArgs = toRunFileArgs(args, selectedManifestFiles);
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "dynamic-lane-runner",
        target: args.target,
        laneGroup: args.laneGroup,
        selectedCount: selectedManifestFiles.length,
        selectedManifestFiles,
        runFileArgs
      },
      null,
      2
    )
  );

  const result = await runCommand("pnpm", buildRunArgs(args, runFileArgs));
  const resultPayload = {
    ok: result.ok,
    mode: "dynamic-lane-runner",
    target: args.target,
    laneGroup: args.laneGroup,
    exitCode: result.exitCode,
    durationMs: result.durationMs
  };
  if (!result.ok) {
    printJsonAndExit(resultPayload, result.exitCode);
    return;
  }

  console.log(JSON.stringify(resultPayload, null, 2));
}

main();
