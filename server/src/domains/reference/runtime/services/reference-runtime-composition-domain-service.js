function normalizeProviderValidationRow(row) {
  if (!row || typeof row !== "object") {
    return null;
  }

  const id = typeof row.id === "string" ? row.id.trim() : "";
  if (id.length === 0) {
    return null;
  }

  const normalized = {
    ...row,
    id
  };
  if (typeof normalized.label !== "string" || normalized.label.trim().length === 0) {
    if (typeof normalized.title === "string" && normalized.title.trim().length > 0) {
      normalized.label = normalized.title.trim();
    } else {
      normalized.label = id;
    }
  } else {
    normalized.label = normalized.label.trim();
  }
  if (typeof normalized.title !== "string" || normalized.title.trim().length === 0) {
    normalized.title = normalized.label;
  } else {
    normalized.title = normalized.title.trim();
  }

  return normalized;
}

function normalizeProviderValidationRowsPayload(payload) {
  const rows = Array.isArray(payload?.rows)
    ? payload.rows
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload)
        ? payload
        : [];

  return rows
    .map((row) => normalizeProviderValidationRow(row))
    .filter((row) => row !== null);
}

export function createReferenceProviderValidationRowsBridge({
  referenceOptionsProviderRegistry,
  moduleRegistry,
  referenceOptionsProviderPolicy,
  state,
  resolveReferenceOptionsProviderRegistration,
  resolveReferenceOptionsProviderLifecycleGate
}) {
  return async function resolveProviderValidationRows(referenceCollectionId) {
    if (typeof referenceCollectionId !== "string" || referenceCollectionId.length === 0) {
      return null;
    }

    const providerRegistration = resolveReferenceOptionsProviderRegistration(
      referenceOptionsProviderRegistry,
      referenceCollectionId
    );
    const provider = providerRegistration?.provider ?? null;
    if (!provider || typeof provider.listValidationRows !== "function") {
      return null;
    }

    const lifecycleGate = resolveReferenceOptionsProviderLifecycleGate({
      providerRegistration,
      moduleRegistry,
      referenceOptionsProviderPolicy
    });
    if (!lifecycleGate.ok) {
      return [];
    }

    try {
      const payload = await provider.listValidationRows({
        referenceCollectionId,
        state,
        moduleRegistry,
        providerModuleId: providerRegistration?.moduleId ?? null,
        providerPolicy: lifecycleGate.policy
      });
      return normalizeProviderValidationRowsPayload(payload);
    } catch {
      return [];
    }
  };
}

export async function registerReferenceRuntimeModuleContributions({
  state,
  moduleRegistry,
  collectionHandlerRegistry,
  persistencePluginRegistry,
  referenceOptionsProviderRegistry,
  serviceRegistry,
  missionRegistry,
  recordsNotesRepository,
  remotesDeployRepository,
  moduleSettingsRepository,
  jobRunner,
  jobLogStore,
  referenceOptionsProviderPolicy,
  registerPersistencePluginsForDiscoveredModules,
  registerCollectionHandlersForDiscoveredModules,
  registerReferenceOptionsProvidersForDiscoveredModules,
  registerServicesForDiscoveredModules,
  registerMissionsForDiscoveredModules,
  createMutationPipeline,
  createSchemaTypeRegistry,
  buildCollectionValidationProfiles,
  validateRecordInput,
  validateNoteInput,
  badRequest,
  validateRecordCrossFieldConstraints,
  nextRecordId,
  slugifyTitle,
  resolveReferenceOptionsProviderRegistration,
  resolveReferenceOptionsProviderLifecycleGate
}) {
  const persistenceRegistration = await registerPersistencePluginsForDiscoveredModules({
    moduleRegistry,
    persistencePluginRegistry,
    registrationContext: {
      state,
      recordsNotesRepository,
      remotesDeployRepository,
      moduleSettingsRepository
    }
  });
  const resolveProviderValidationRows = createReferenceProviderValidationRowsBridge({
    referenceOptionsProviderRegistry,
    moduleRegistry,
    referenceOptionsProviderPolicy,
    state,
    resolveReferenceOptionsProviderRegistration,
    resolveReferenceOptionsProviderLifecycleGate
  });
  const collectionHandlerRegistration = await registerCollectionHandlersForDiscoveredModules({
    moduleRegistry,
    collectionHandlerRegistry,
    registrationContext: {
      state,
      jobRunner,
      createMutationPipeline,
      createSchemaTypeRegistry,
      buildCollectionValidationProfiles,
      validateRecordInput,
      validateNoteInput,
      badRequest,
      validateRecordCrossFieldConstraints,
      nextRecordId,
      slugifyTitle,
      recordsNotesRepository,
      resolveCollectionRepository: (collectionId) =>
        persistencePluginRegistry.getCollectionRepository(collectionId),
      resolveProviderValidationRows,
      resolveSettingsRepository: (moduleId) =>
        persistencePluginRegistry.getSettingsRepository(moduleId)
    }
  });
  const referenceOptionsProviderRegistration =
    await registerReferenceOptionsProvidersForDiscoveredModules({
      moduleRegistry,
      referenceOptionsProviderRegistry,
      registrationContext: {
        state,
        moduleRegistry,
        missionRegistry
      }
    });
  const serviceRegistration = await registerServicesForDiscoveredModules({
    moduleRegistry,
    serviceRegistry,
    registrationContext: {
      state,
      moduleRegistry,
      jobRunner,
      jobLogStore
    }
  });
  const missionRegistration = await registerMissionsForDiscoveredModules({
    moduleRegistry,
    missionRegistry,
    registrationContext: {
      state,
      moduleRegistry,
      jobRunner,
      jobLogStore
    }
  });

  return {
    persistenceRegistration,
    collectionHandlerRegistration,
    referenceOptionsProviderRegistration,
    serviceRegistration,
    missionRegistration
  };
}

export function createReferenceRuntimeResolvers({
  moduleRegistry,
  collectionHandlerRegistry,
  persistencePluginRegistry,
  serviceRegistry,
  missionRegistry,
  referenceOptionsProviderRegistry,
  persistenceRegistration,
  serviceRegistration,
  missionRegistration,
  referenceOptionsProviderRegistration,
  resolveCollectionDefinitions,
  augmentPersistenceResolutionWithPolicyMaps,
  resolveModuleSettingsDefinitions
}) {
  const resolveCollectionResolution = (options = {}) =>
    resolveCollectionDefinitions(moduleRegistry, options);
  const resolveCollectionHandlerResolution = (collectionResolution = resolveCollectionResolution()) =>
    collectionHandlerRegistry.resolveStatus(collectionResolution);
  const resolvePersistenceResolution = () =>
    augmentPersistenceResolutionWithPolicyMaps(
      persistencePluginRegistry.resolveStatus({
        moduleRegistry,
        additionalDiagnostics: persistenceRegistration.diagnostics
      }),
      {
        persistencePluginRegistry,
        moduleRegistry
      }
    );
  const resolveModuleSettingsResolution = () =>
    resolveModuleSettingsDefinitions(moduleRegistry);
  const resolveServiceResolution = () =>
    serviceRegistry.resolveStatus({
      moduleRegistry,
      additionalDiagnostics: serviceRegistration.diagnostics
    });
  const resolveMissionResolution = () =>
    missionRegistry.resolveStatus({
      moduleRegistry,
      additionalDiagnostics: missionRegistration.diagnostics
    });
  const resolveReferenceOptionsProviderResolution = () =>
    referenceOptionsProviderRegistry.resolveStatus({
      moduleRegistry,
      additionalDiagnostics: referenceOptionsProviderRegistration.diagnostics
    });

  return {
    resolveCollectionResolution,
    resolveCollectionHandlerResolution,
    resolvePersistenceResolution,
    resolveModuleSettingsResolution,
    resolveServiceResolution,
    resolveMissionResolution,
    resolveReferenceOptionsProviderResolution
  };
}

export function buildReferenceModuleRuntimePayload({
  moduleDiscovery,
  runtimeDiagnostics,
  persistenceRegistration,
  collectionHandlerRegistration,
  referenceOptionsProviderRegistration,
  serviceRegistration,
  missionRegistration,
  referenceStatePersistenceSummary,
  referenceOptionsProviderPolicy,
  moduleIdTranslation,
  moduleRuntimeStateStore,
  runtimeStateLoad,
  runtimeStateAppliedCount,
  runtimeStatePersistResult
}) {
  const translationSummary =
    typeof moduleIdTranslation?.summarize === "function"
      ? moduleIdTranslation.summarize()
      : {
          enabled: false,
          mode: "off",
          mapPath: null,
          mappingCount: 0,
          discoveredModuleCount: 0,
          discoveredLegacyModuleCount: 0,
          discoveredTargetModuleCount: 0,
          discoveredModuleIds: [],
          discoveredLegacyModuleIds: [],
          discoveredTargetModuleIds: []
        };
  const translationDiagnostics = Array.isArray(moduleIdTranslation?.diagnostics)
    ? moduleIdTranslation.diagnostics
    : [];

  return {
    modulesDir: moduleDiscovery.modulesDir,
    moduleSourcePosture: moduleDiscovery.sourcePosture,
    diagnostics: [
      ...runtimeDiagnostics,
      ...persistenceRegistration.diagnostics,
      ...collectionHandlerRegistration.diagnostics,
      ...referenceOptionsProviderRegistration.diagnostics,
      ...serviceRegistration.diagnostics,
      ...missionRegistration.diagnostics,
      ...translationDiagnostics
    ],
    moduleIdTranslation: translationSummary,
    referenceStatePersistence: referenceStatePersistenceSummary,
    referenceOptionsProviderPolicy: {
      lifecycle: referenceOptionsProviderPolicy
    },
    persistence: {
      enabled: moduleRuntimeStateStore.enabled,
      stateFilePath: moduleRuntimeStateStore.stateFilePath,
      source: runtimeStateLoad.source,
      appliedCount: runtimeStateAppliedCount,
      updatedAt:
        runtimeStatePersistResult.snapshot?.updatedAt ??
        runtimeStateLoad.snapshot?.updatedAt ??
        null
    }
  };
}
