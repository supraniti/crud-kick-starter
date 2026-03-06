export function valueOrFallback(value, fallback) {
  if (value === null || value === undefined) {
    return fallback;
  }

  return value;
}

export function collectModuleRuntimeDiagnostics({
  runtime,
  collectionResolution,
  collectionHandlerResolution,
  serviceResolution,
  missionResolution,
  referenceOptionsProviderResolution,
  persistenceResolution,
  settingsResolution
}) {
  return {
    runtimeDiagnostics: valueOrFallback(runtime?.diagnostics, []),
    collectionDiagnostics: valueOrFallback(collectionResolution?.diagnostics, []),
    handlerDiagnostics: valueOrFallback(collectionHandlerResolution?.diagnostics, []),
    serviceDiagnostics: valueOrFallback(serviceResolution?.diagnostics, []),
    missionDiagnostics: valueOrFallback(missionResolution?.diagnostics, []),
    referenceOptionsProviderDiagnostics: valueOrFallback(
      referenceOptionsProviderResolution?.diagnostics,
      []
    ),
    persistenceDiagnostics: valueOrFallback(persistenceResolution?.diagnostics, []),
    moduleSettingsDiagnostics: valueOrFallback(settingsResolution?.diagnostics, [])
  };
}

export function hasNoModuleRuntimeDiagnostics(diagnostics) {
  return (
    diagnostics.runtimeDiagnostics.length +
      diagnostics.collectionDiagnostics.length +
      diagnostics.handlerDiagnostics.length +
      diagnostics.serviceDiagnostics.length +
      diagnostics.missionDiagnostics.length +
      diagnostics.referenceOptionsProviderDiagnostics.length +
      diagnostics.persistenceDiagnostics.length +
      diagnostics.moduleSettingsDiagnostics.length ===
    0
  );
}

export function resolveCollectionAndHandlerRuntimeFields({
  collectionResolution,
  activeCollectionResolution,
  collectionHandlerResolution,
  activeCollectionHandlerResolution
}) {
  return {
    moduleCollectionIds: valueOrFallback(collectionResolution?.moduleCollectionIds, []),
    activeCollectionIds: valueOrFallback(activeCollectionResolution?.moduleCollectionIds, []),
    collectionModuleMap: valueOrFallback(collectionResolution?.collectionModuleMap, {}),
    activeCollectionModuleMap: valueOrFallback(
      activeCollectionResolution?.collectionModuleMap,
      {}
    ),
    registeredCollectionHandlerIds: valueOrFallback(
      collectionHandlerResolution?.registeredCollectionIds,
      []
    ),
    activeRegisteredCollectionHandlerIds: valueOrFallback(
      activeCollectionHandlerResolution?.registeredCollectionIds,
      []
    ),
    collectionHandlerModuleMap: valueOrFallback(
      collectionHandlerResolution?.collectionHandlerModuleMap,
      {}
    ),
    activeCollectionHandlerModuleMap: valueOrFallback(
      activeCollectionHandlerResolution?.collectionHandlerModuleMap,
      {}
    )
  };
}

export function resolveServiceAndMissionRuntimeFields({ serviceResolution, missionResolution }) {
  return {
    registeredServiceIds: valueOrFallback(serviceResolution?.registeredServiceIds, []),
    activeRegisteredServiceIds: valueOrFallback(
      serviceResolution?.activeRegisteredServiceIds,
      []
    ),
    serviceModuleMap: valueOrFallback(serviceResolution?.serviceModuleMap, {}),
    activeServiceModuleMap: valueOrFallback(serviceResolution?.activeServiceModuleMap, {}),
    registeredMissionIds: valueOrFallback(missionResolution?.registeredMissionIds, []),
    activeRegisteredMissionIds: valueOrFallback(
      missionResolution?.activeRegisteredMissionIds,
      []
    ),
    missionModuleMap: valueOrFallback(missionResolution?.missionModuleMap, {}),
    activeMissionModuleMap: valueOrFallback(missionResolution?.activeMissionModuleMap, {})
  };
}

export function resolveReferenceOptionsProviderRuntimeFields(
  runtime,
  referenceOptionsProviderResolution
) {
  return {
    referenceOptionsProviderPolicy: valueOrFallback(runtime?.referenceOptionsProviderPolicy, {
      lifecycle: "unknown"
    }),
    registeredReferenceOptionsProviderCollectionIds: valueOrFallback(
      referenceOptionsProviderResolution?.registeredReferenceCollectionIds,
      []
    ),
    activeRegisteredReferenceOptionsProviderCollectionIds: valueOrFallback(
      referenceOptionsProviderResolution?.activeRegisteredReferenceCollectionIds,
      []
    ),
    referenceOptionsProviderModuleMap: valueOrFallback(
      referenceOptionsProviderResolution?.referenceOptionsProviderModuleMap,
      {}
    ),
    activeReferenceOptionsProviderModuleMap: valueOrFallback(
      referenceOptionsProviderResolution?.activeReferenceOptionsProviderModuleMap,
      {}
    )
  };
}

export function resolvePersistenceRuntimeFields(persistenceResolution) {
  return {
    registeredPersistencePluginIds: valueOrFallback(
      persistenceResolution?.registeredPluginIds,
      []
    ),
    persistencePluginModuleMap: valueOrFallback(persistenceResolution?.pluginModuleMap, {}),
    collectionRepositoryModuleMap: valueOrFallback(
      persistenceResolution?.collectionRepositoryModuleMap,
      {}
    ),
    activeCollectionRepositoryModuleMap: valueOrFallback(
      persistenceResolution?.activeCollectionRepositoryModuleMap,
      {}
    ),
    collectionRepositoryPolicyMap: valueOrFallback(
      persistenceResolution?.collectionRepositoryPolicyMap,
      {}
    ),
    activeCollectionRepositoryPolicyMap: valueOrFallback(
      persistenceResolution?.activeCollectionRepositoryPolicyMap,
      {}
    ),
    settingsRepositoryModuleMap: valueOrFallback(
      persistenceResolution?.settingsRepositoryModuleMap,
      {}
    ),
    settingsRepositoryPolicyMap: valueOrFallback(
      persistenceResolution?.settingsRepositoryPolicyMap,
      {}
    ),
    activeSettingsRepositoryModuleMap: valueOrFallback(
      persistenceResolution?.activeSettingsRepositoryModuleMap,
      {}
    ),
    activeSettingsRepositoryPolicyMap: valueOrFallback(
      persistenceResolution?.activeSettingsRepositoryPolicyMap,
      {}
    )
  };
}

export function resolveModuleSettingsRuntimeFields(
  settingsResolution,
  persistenceRuntimeFields
) {
  const moduleSettingsIds = valueOrFallback(settingsResolution?.moduleIds, []);
  const activeSettingsRepositoryModuleMap =
    persistenceRuntimeFields.activeSettingsRepositoryModuleMap;

  return {
    moduleSettingsIds,
    activeModuleSettingsIds: moduleSettingsIds.filter((moduleId) =>
      Object.prototype.hasOwnProperty.call(activeSettingsRepositoryModuleMap, moduleId)
    )
  };
}
