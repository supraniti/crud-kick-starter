function resolveModuleLifecycleErrorStatus(code) {
  if (code === "MODULE_NOT_DISCOVERED") {
    return 404;
  }
  if (
    code === "MODULE_NOT_INSTALLED" ||
    code === "MODULE_INSTALL_HOOK_FAILED" ||
    code === "MODULE_UNINSTALL_HOOK_FAILED"
  ) {
    return 409;
  }
  return 500;
}

export function buildModuleLifecycleErrorResult({
  action,
  moduleId,
  beforeState,
  error,
  moduleRegistry
}) {
  const code = error?.code ?? "MODULE_LIFECYCLE_ACTION_FAILED";
  return {
    statusCode: resolveModuleLifecycleErrorStatus(code),
    payload: {
      ok: false,
      action,
      moduleId,
      state: {
        before: beforeState ?? null,
        after: moduleRegistry.getState(moduleId) ?? null
      },
      error: {
        code,
        message: error?.message ?? `Module lifecycle action '${action}' failed`
      },
      timestamp: new Date().toISOString()
    }
  };
}

export async function persistModuleRuntimeStateIfConfigured({
  persistModuleRuntimeState,
  moduleRuntime
}) {
  if (typeof persistModuleRuntimeState !== "function") {
    return null;
  }

  const persistenceResult = await persistModuleRuntimeState();
  if (!persistenceResult?.ok) {
    const persistenceError = new Error(
      persistenceResult?.error?.message ?? "Failed persisting module runtime state"
    );
    persistenceError.code =
      persistenceResult?.error?.code ?? "MODULE_RUNTIME_STATE_WRITE_FAILED";
    throw persistenceError;
  }

  moduleRuntime.persistence = {
    ...(moduleRuntime.persistence ?? {}),
    enabled: persistenceResult.enabled,
    stateFilePath: persistenceResult.stateFilePath ?? null,
    source: persistenceResult.enabled ? "mutation" : "disabled",
    updatedAt: persistenceResult.snapshot?.updatedAt ?? null
  };
  return persistenceResult;
}

export function createModuleLifecycleActions({
  moduleLoader,
  moduleRegistry
}) {
  return {
    install: async (moduleId) => moduleLoader.install(moduleId),
    uninstall: async (moduleId) => moduleLoader.uninstall(moduleId),
    enable: async (moduleId) => moduleRegistry.enable(moduleId),
    disable: async (moduleId) => moduleRegistry.disable(moduleId)
  };
}

function countResolutionDiagnostics(resolution) {
  return resolution?.diagnostics?.length ?? 0;
}

export function resolveReferenceModulesListingData({
  moduleRegistry,
  moduleRuntime,
  resolveCollectionResolution,
  resolveCollectionHandlerResolution,
  resolveServiceResolution,
  resolveMissionResolution,
  resolveReferenceOptionsProviderResolution,
  resolvePersistenceResolution,
  resolveModuleSettingsResolution,
  buildModuleNavigationItems
}) {
  const collectionResolution = resolveCollectionResolution();
  const collectionHandlerResolution = resolveCollectionHandlerResolution(collectionResolution);
  const serviceResolution = resolveServiceResolution();
  const missionResolution = resolveMissionResolution();
  const referenceOptionsProviderResolution = resolveReferenceOptionsProviderResolution();
  const persistenceResolution = resolvePersistenceResolution();
  const moduleSettingsResolution = resolveModuleSettingsResolution();
  const diagnosticsCount =
    countResolutionDiagnostics(moduleRuntime) +
    countResolutionDiagnostics(collectionResolution) +
    countResolutionDiagnostics(collectionHandlerResolution) +
    countResolutionDiagnostics(serviceResolution) +
    countResolutionDiagnostics(missionResolution) +
    countResolutionDiagnostics(referenceOptionsProviderResolution) +
    countResolutionDiagnostics(persistenceResolution) +
    countResolutionDiagnostics(moduleSettingsResolution);

  return {
    items: buildModuleNavigationItems(moduleRegistry),
    runtimeOk: diagnosticsCount === 0,
    diagnosticsCount
  };
}

export function resolveReferenceModulesRuntimeData({
  moduleRuntime,
  moduleRegistry,
  resolveCollectionResolution,
  resolveCollectionHandlerResolution,
  resolveServiceResolution,
  resolveMissionResolution,
  resolveReferenceOptionsProviderResolution,
  resolvePersistenceResolution,
  resolveModuleSettingsResolution,
  buildModuleRuntimePayload
}) {
  const collectionResolution = resolveCollectionResolution();
  const activeCollectionResolution = resolveCollectionResolution({
    activeOnly: true
  });
  const collectionHandlerResolution = resolveCollectionHandlerResolution(collectionResolution);
  const activeCollectionHandlerResolution =
    resolveCollectionHandlerResolution(activeCollectionResolution);
  const serviceResolution = resolveServiceResolution();
  const missionResolution = resolveMissionResolution();
  const referenceOptionsProviderResolution = resolveReferenceOptionsProviderResolution();
  const persistenceResolution = resolvePersistenceResolution();
  const moduleSettingsResolution = resolveModuleSettingsResolution();

  return buildModuleRuntimePayload(
    moduleRuntime,
    moduleRegistry,
    collectionResolution,
    activeCollectionResolution,
    collectionHandlerResolution,
    activeCollectionHandlerResolution,
    serviceResolution,
    missionResolution,
    referenceOptionsProviderResolution,
    persistenceResolution,
    moduleSettingsResolution
  );
}

export function resolveActiveCollectionDefinitions(
  resolveCollectionResolution
) {
  const activeCollectionResolution = resolveCollectionResolution({
    activeOnly: true
  });
  return activeCollectionResolution.definitions;
}

export function resolveActiveCollectionSchemaById({
  resolveCollectionResolution,
  getCollectionDefinition,
  collectionId
}) {
  const definitions = resolveActiveCollectionDefinitions(resolveCollectionResolution);
  return getCollectionDefinition(definitions, collectionId);
}
