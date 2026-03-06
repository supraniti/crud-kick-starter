const GENERATED_PERSISTENCE_MODE_ENV = "CRUD_CONTROL_GENERATED_MODULE_PERSISTENCE_MODE";
const GENERATED_PERSISTENCE_MODE_VALUES = new Set(["auto", "file", "memory"]);

function formatModuleEnvKey(moduleId) {
  const normalized = `${moduleId}`.trim().replace(/[^A-Za-z0-9]+/g, "_").toUpperCase();
  return `CRUD_CONTROL_GENERATED_MODULE_${normalized}_PERSISTENCE_MODE`;
}

function parseRequestedPersistenceMode(rawValue) {
  const normalized = typeof rawValue === "string" ? rawValue.trim().toLowerCase() : "";
  if (normalized.length === 0) {
    return null;
  }

  if (!GENERATED_PERSISTENCE_MODE_VALUES.has(normalized)) {
    const error = new Error(
      `Generated-module persistence mode '${normalized}' is not supported`
    );
    error.code = "GENERATED_MODULE_PERSISTENCE_POLICY_INVALID";
    error.details = [
      `${GENERATED_PERSISTENCE_MODE_ENV} must be one of: auto, file, memory`
    ];
    throw error;
  }

  return normalized;
}

function resolveGeneratedModulePersistencePolicy({
  moduleId,
  persistenceMode
} = {}) {
  const normalizedModuleId =
    typeof moduleId === "string" && moduleId.trim().length > 0
      ? moduleId.trim()
      : "generated-module";
  const moduleEnvKey = formatModuleEnvKey(normalizedModuleId);

  const modeFromInput =
    typeof persistenceMode === "string" && persistenceMode.trim().length > 0
      ? parseRequestedPersistenceMode(persistenceMode)
      : null;
  const modeFromModuleEnv = parseRequestedPersistenceMode(process.env[moduleEnvKey]);
  const modeFromGlobalEnv = parseRequestedPersistenceMode(
    process.env[GENERATED_PERSISTENCE_MODE_ENV]
  );

  let requestedMode = modeFromInput;
  let source = "input";
  if (requestedMode === null) {
    requestedMode = modeFromModuleEnv;
    source = "module-env";
  }
  if (requestedMode === null) {
    requestedMode = modeFromGlobalEnv;
    source = "global-env";
  }
  if (requestedMode === null) {
    requestedMode = "auto";
    source = "default";
  }

  const runtimeMode =
    requestedMode === "auto"
      ? process.env.NODE_ENV === "test"
        ? "memory"
        : "file"
      : requestedMode;

  return {
    configuredMode: requestedMode,
    runtimeMode,
    mode: runtimeMode,
    source,
    moduleEnvKey,
    globalEnvKey: GENERATED_PERSISTENCE_MODE_ENV
  };
}

export { resolveGeneratedModulePersistencePolicy };
