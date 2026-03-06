import fs from "node:fs/promises";
import path from "node:path";
import { MODULE_LIFECYCLE_STATES } from "../../../core/module-registry.js";

const MODULE_RUNTIME_STATE_VERSION = 1;
const MODULE_LIFECYCLE_STATE_SET = new Set(MODULE_LIFECYCLE_STATES);

function toDiagnostic(code, message, extra = {}) {
  return {
    code,
    message,
    ...extra
  };
}

function normalizeStateFilePath(input) {
  if (typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }

  return path.resolve(trimmed);
}

function normalizeSnapshot(input, stateFilePath) {
  const diagnostics = [];

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    diagnostics.push(
      toDiagnostic(
        "MODULE_RUNTIME_STATE_FORMAT_INVALID",
        "Persisted runtime state must be an object",
        { stateFilePath }
      )
    );
    return {
      diagnostics,
      snapshot: null
    };
  }

  if (input.version !== MODULE_RUNTIME_STATE_VERSION) {
    diagnostics.push(
      toDiagnostic(
        "MODULE_RUNTIME_STATE_VERSION_UNSUPPORTED",
        `Unsupported runtime-state version '${input.version}'`,
        { stateFilePath }
      )
    );
    return {
      diagnostics,
      snapshot: null
    };
  }

  if (!input.modules || typeof input.modules !== "object" || Array.isArray(input.modules)) {
    diagnostics.push(
      toDiagnostic(
        "MODULE_RUNTIME_STATE_FORMAT_INVALID",
        "Persisted runtime state requires a modules map",
        { stateFilePath }
      )
    );
    return {
      diagnostics,
      snapshot: null
    };
  }

  const modules = {};
  for (const [moduleId, rawState] of Object.entries(input.modules)) {
    if (typeof rawState !== "string" || !MODULE_LIFECYCLE_STATE_SET.has(rawState)) {
      diagnostics.push(
        toDiagnostic(
          "MODULE_RUNTIME_STATE_INVALID",
          `Persisted state '${rawState}' for module '${moduleId}' is invalid`,
          {
            moduleId,
            stateFilePath
          }
        )
      );
      continue;
    }

    modules[moduleId] = rawState;
  }

  return {
    diagnostics,
    snapshot: {
      version: MODULE_RUNTIME_STATE_VERSION,
      modules,
      updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : null
    }
  };
}

function buildSnapshot(registry) {
  const modules = {};
  for (const { manifest, state } of registry.list()) {
    modules[manifest.id] = state ?? "discovered";
  }

  return {
    version: MODULE_RUNTIME_STATE_VERSION,
    modules,
    updatedAt: new Date().toISOString()
  };
}

function disabledLoadSnapshotResult() {
  return {
    ok: true,
    enabled: false,
    source: "disabled",
    stateFilePath: null,
    snapshot: null,
    diagnostics: []
  };
}

function missingLoadSnapshotResult(stateFilePath) {
  return {
    ok: true,
    enabled: true,
    source: "missing",
    stateFilePath,
    snapshot: null,
    diagnostics: []
  };
}

function failedLoadSnapshotResult(code, message, stateFilePath) {
  return {
    ok: false,
    enabled: true,
    source: "error",
    stateFilePath,
    snapshot: null,
    diagnostics: [toDiagnostic(code, message, { stateFilePath })]
  };
}

async function readStateSnapshotFile(stateFilePath) {
  try {
    return {
      ok: true,
      content: await fs.readFile(stateFilePath, "utf8")
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        ok: true,
        content: null
      };
    }

    return {
      ok: false,
      error: failedLoadSnapshotResult(
        "MODULE_RUNTIME_STATE_READ_FAILED",
        error?.message ?? "Failed to read module runtime state file",
        stateFilePath
      )
    };
  }
}

function parseStateSnapshot(rawContent, stateFilePath) {
  try {
    return {
      ok: true,
      parsed: JSON.parse(rawContent)
    };
  } catch (error) {
    return {
      ok: false,
      error: failedLoadSnapshotResult(
        "MODULE_RUNTIME_STATE_PARSE_FAILED",
        error?.message ?? "Failed to parse module runtime state file",
        stateFilePath
      )
    };
  }
}

function createLoadSnapshotHandler(enabled, stateFilePath) {
  return async function loadSnapshot() {
    if (!enabled) {
      return disabledLoadSnapshotResult();
    }

    const readResult = await readStateSnapshotFile(stateFilePath);
    if (!readResult.ok) {
      return readResult.error;
    }
    if (readResult.content === null) {
      return missingLoadSnapshotResult(stateFilePath);
    }

    const parseResult = parseStateSnapshot(readResult.content, stateFilePath);
    if (!parseResult.ok) {
      return parseResult.error;
    }

    const normalized = normalizeSnapshot(parseResult.parsed, stateFilePath);
    return {
      ok: normalized.diagnostics.length === 0,
      enabled: true,
      source: "file",
      stateFilePath,
      snapshot: normalized.snapshot,
      diagnostics: normalized.diagnostics
    };
  };
}

function createApplySnapshotHandler(stateFilePath) {
  return function applySnapshot(registry, snapshot) {
    if (!snapshot) {
      return {
        appliedCount: 0,
        diagnostics: []
      };
    }

    const diagnostics = [];
    const discoveredIds = new Set(registry.list().map(({ manifest }) => manifest.id));
    let appliedCount = 0;

    for (const [moduleId, persistedState] of Object.entries(snapshot.modules ?? {})) {
      if (!discoveredIds.has(moduleId)) {
        diagnostics.push(
          toDiagnostic(
            "MODULE_RUNTIME_STATE_ORPHAN_MODULE",
            `Persisted module '${moduleId}' is not discovered at startup`,
            {
              moduleId,
              stateFilePath
            }
          )
        );
        continue;
      }

      try {
        registry.setState(moduleId, persistedState);
        appliedCount += 1;
      } catch (error) {
        diagnostics.push(
          toDiagnostic(
            "MODULE_RUNTIME_STATE_APPLY_FAILED",
            error?.message ?? `Failed applying persisted state for module '${moduleId}'`,
            {
              moduleId,
              stateFilePath
            }
          )
        );
      }
    }

    return {
      appliedCount,
      diagnostics
    };
  };
}

function disabledSaveSnapshotResult() {
  return {
    ok: true,
    enabled: false,
    persisted: false,
    stateFilePath: null,
    snapshot: null
  };
}

async function writeSnapshotFile(stateFilePath, snapshot) {
  await fs.mkdir(path.dirname(stateFilePath), {
    recursive: true
  });
  await fs.writeFile(`${stateFilePath}`, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  return {
    ok: true,
    enabled: true,
    persisted: true,
    stateFilePath,
    snapshot
  };
}

function createSaveSnapshotHandler(enabled, stateFilePath, getWriteQueue, setWriteQueue) {
  return async function saveSnapshot(registry) {
    if (!enabled) {
      return disabledSaveSnapshotResult();
    }

    const snapshot = buildSnapshot(registry);
    const runWrite = async () => writeSnapshotFile(stateFilePath, snapshot);
    setWriteQueue(getWriteQueue().then(runWrite, runWrite));

    try {
      return await getWriteQueue();
    } catch (error) {
      return {
        ok: false,
        enabled: true,
        persisted: false,
        stateFilePath,
        snapshot,
        error: toDiagnostic(
          "MODULE_RUNTIME_STATE_WRITE_FAILED",
          error?.message ?? "Failed writing module runtime state file",
          { stateFilePath }
        )
      };
    }
  };
}

export function createModuleRuntimeStateStore(options = {}) {
  const stateFilePath = normalizeStateFilePath(options.stateFilePath);
  const enabled = stateFilePath !== null;
  let writeQueue = Promise.resolve();

  return {
    enabled,
    stateFilePath,
    loadSnapshot: createLoadSnapshotHandler(enabled, stateFilePath),
    applySnapshot: createApplySnapshotHandler(stateFilePath),
    saveSnapshot: createSaveSnapshotHandler(
      enabled,
      stateFilePath,
      () => writeQueue,
      (nextQueue) => {
        writeQueue = nextQueue;
      }
    )
  };
}
