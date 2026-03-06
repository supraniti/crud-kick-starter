import {
  collectModuleRuntimeDiagnostics,
  hasNoModuleRuntimeDiagnostics,
  resolveCollectionAndHandlerRuntimeFields,
  resolveModuleSettingsRuntimeFields,
  resolvePersistenceRuntimeFields,
  resolveReferenceOptionsProviderRuntimeFields,
  resolveServiceAndMissionRuntimeFields,
  valueOrFallback
} from "./reference-runtime-payload-helper-domain-service.js";
import {
  manifestCollectionsForModule
} from "./reference-runtime-collection-and-navigation-domain-service.js";

export {
  buildCollectionsPayload,
  buildModuleNavigationItems,
  cloneCollectionDefinition,
  cloneCollectionDefinitions,
  getCollectionDefinition,
  resolveCollectionDefinitions,
  toModuleNavigationItem
} from "./reference-runtime-collection-and-navigation-domain-service.js";
export {
  augmentPersistenceResolutionWithPolicyMaps
} from "./reference-runtime-persistence-policy-map-domain-service.js";

function normalizeModuleSourceTrackingToken(value) {
  const token = typeof value === "string" ? value.trim().toLowerCase() : "";
  return token === "tracked" || token === "untracked" || token === "unknown"
    ? token
    : "unknown";
}

function resolveManifestSourceTrackingSnapshot(manifest) {
  const moduleId = typeof manifest?.id === "string" ? manifest.id : "";
  if (!moduleId) {
    return null;
  }

  const source = manifest?.source;
  const tracking = normalizeModuleSourceTrackingToken(source?.tracking);
  const trackingReason =
    typeof source?.trackingReason === "string" && source.trackingReason.length > 0
      ? source.trackingReason
      : "unknown";

  return {
    moduleId,
    tracking,
    trackingReason,
    source
  };
}

function buildModuleSourceTrackingWarning({ moduleId, tracking, source, trackingReason }) {
  const isUntracked = tracking === "untracked";
  return {
    code: isUntracked ? "MODULE_SOURCE_UNTRACKED" : "MODULE_SOURCE_TRACKING_UNKNOWN",
    message: isUntracked
      ? `Module '${moduleId}' manifest source is not tracked by git`
      : `Module '${moduleId}' manifest source tracking could not be verified`,
    moduleId,
    moduleDir: source?.moduleDir ?? null,
    manifestPath: source?.manifestPath ?? null,
    reason: trackingReason
  };
}

function recordModuleSourceTracking(postureState, trackingSnapshot) {
  const { moduleId, tracking } = trackingSnapshot;
  postureState.trackingByModuleId[moduleId] = tracking;

  if (tracking === "tracked") {
    postureState.trackedModuleIds.push(moduleId);
    return;
  }

  if (tracking === "untracked") {
    postureState.untrackedModuleIds.push(moduleId);
  } else {
    postureState.unknownModuleIds.push(moduleId);
  }

  postureState.warnings.push(buildModuleSourceTrackingWarning(trackingSnapshot));
}

function buildFallbackModuleSourcePosture(registry) {
  const postureState = {
    trackedModuleIds: [],
    untrackedModuleIds: [],
    unknownModuleIds: [],
    trackingByModuleId: {},
    warnings: []
  };

  for (const { manifest } of registry.list()) {
    const trackingSnapshot = resolveManifestSourceTrackingSnapshot(manifest);
    if (!trackingSnapshot) {
      continue;
    }

    recordModuleSourceTracking(postureState, trackingSnapshot);
  }

  const uniqueTrackedModuleIds = [...new Set(postureState.trackedModuleIds)].sort();
  const uniqueUntrackedModuleIds = [...new Set(postureState.untrackedModuleIds)].sort();
  const uniqueUnknownModuleIds = [...new Set(postureState.unknownModuleIds)].sort();

  return {
    provider: "manifest-source",
    repoRootDir: null,
    trackedModuleIds: uniqueTrackedModuleIds,
    untrackedModuleIds: uniqueUntrackedModuleIds,
    unknownModuleIds: uniqueUnknownModuleIds,
    trackingByModuleId: postureState.trackingByModuleId,
    hasUntrackedModules: uniqueUntrackedModuleIds.length > 0,
    reproducible:
      uniqueUntrackedModuleIds.length === 0 && uniqueUnknownModuleIds.length === 0,
    warningCount: postureState.warnings.length,
    warnings: postureState.warnings
  };
}

function resolveRuntimeModuleSourcePosture(runtime, registry) {
  if (
    runtime?.moduleSourcePosture &&
    typeof runtime.moduleSourcePosture === "object" &&
    !Array.isArray(runtime.moduleSourcePosture)
  ) {
    return runtime.moduleSourcePosture;
  }

  return buildFallbackModuleSourcePosture(registry);
}

function buildRuntimeModuleItems(registry) {
  return registry.list().map(({ manifest, state }) => ({
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    capabilities: [...manifest.capabilities],
    state,
    ui: manifest.ui,
    collectionIds: manifestCollectionsForModule(manifest).map((collection) => collection.id)
  }));
}

function resolveRuntimeReferenceStatePersistence(runtime) {
  return valueOrFallback(runtime?.referenceStatePersistence, {
    enabled: false,
    configuredMode: "unknown",
    runtimeMode: "unknown",
    allowMemoryFallback: null,
    failFast: null,
    mongoUriConfigured: null,
    mongoServerSelectionTimeoutMs: null,
    databaseName: null,
    collectionName: null,
    moduleSettingsDocumentId: null
  });
}

function resolveRuntimeModuleIdTranslation(runtime) {
  return valueOrFallback(runtime?.moduleIdTranslation, {
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
  });
}

function resolveRuntimePersistence(runtime) {
  return valueOrFallback(runtime?.persistence, {
    enabled: false,
    stateFilePath: null,
    source: "unknown",
    appliedCount: 0,
    updatedAt: null
  });
}

export function buildModuleRuntimePayload(
  runtime,
  registry,
  collectionResolution,
  activeCollectionResolution = collectionResolution,
  collectionHandlerResolution = {
    registeredCollectionIds: [],
    collectionHandlerModuleMap: {},
    diagnostics: []
  },
  activeCollectionHandlerResolution = collectionHandlerResolution,
  serviceResolution = {
    registeredServiceIds: [],
    activeRegisteredServiceIds: [],
    serviceModuleMap: {},
    activeServiceModuleMap: {},
    diagnostics: []
  },
  missionResolution = {
    registeredMissionIds: [],
    activeRegisteredMissionIds: [],
    missionModuleMap: {},
    activeMissionModuleMap: {},
    diagnostics: []
  },
  referenceOptionsProviderResolution = {
    registeredReferenceCollectionIds: [],
    activeRegisteredReferenceCollectionIds: [],
    referenceOptionsProviderModuleMap: {},
    activeReferenceOptionsProviderModuleMap: {},
    diagnostics: []
  },
  persistenceResolution = {
    registeredPluginIds: [],
    pluginModuleMap: {},
    collectionRepositoryModuleMap: {},
    activeCollectionRepositoryModuleMap: {},
    collectionRepositoryPolicyMap: {},
    activeCollectionRepositoryPolicyMap: {},
    settingsRepositoryModuleMap: {},
    settingsRepositoryPolicyMap: {},
    activeSettingsRepositoryModuleMap: {},
    activeSettingsRepositoryPolicyMap: {},
    diagnostics: []
  },
  settingsResolution = {
    moduleIds: [],
    diagnostics: []
  }
) {
  const diagnostics = collectModuleRuntimeDiagnostics({
    runtime,
    collectionResolution,
    collectionHandlerResolution,
    serviceResolution,
    missionResolution,
    referenceOptionsProviderResolution,
    persistenceResolution,
    settingsResolution
  });
  const moduleSourcePosture = resolveRuntimeModuleSourcePosture(runtime, registry);
  const collectionAndHandlerFields = resolveCollectionAndHandlerRuntimeFields({
    collectionResolution,
    activeCollectionResolution,
    collectionHandlerResolution,
    activeCollectionHandlerResolution
  });
  const serviceAndMissionFields = resolveServiceAndMissionRuntimeFields({
    serviceResolution,
    missionResolution
  });
  const referenceOptionsProviderFields = resolveReferenceOptionsProviderRuntimeFields(
    runtime,
    referenceOptionsProviderResolution
  );
  const persistenceRuntimeFields = resolvePersistenceRuntimeFields(persistenceResolution);
  const moduleSettingsRuntimeFields = resolveModuleSettingsRuntimeFields(
    settingsResolution,
    persistenceRuntimeFields
  );

  return {
    modulesDir: runtime.modulesDir,
    ok: hasNoModuleRuntimeDiagnostics(diagnostics),
    diagnostics: diagnostics.runtimeDiagnostics,
    collectionDiagnostics: diagnostics.collectionDiagnostics,
    handlerDiagnostics: diagnostics.handlerDiagnostics,
    serviceDiagnostics: diagnostics.serviceDiagnostics,
    missionDiagnostics: diagnostics.missionDiagnostics,
    referenceOptionsProviderDiagnostics:
      diagnostics.referenceOptionsProviderDiagnostics,
    persistencePluginDiagnostics: diagnostics.persistenceDiagnostics,
    moduleSettingsDiagnostics: diagnostics.moduleSettingsDiagnostics,
    referenceStatePersistence: resolveRuntimeReferenceStatePersistence(runtime),
    moduleIdTranslation: resolveRuntimeModuleIdTranslation(runtime),
    moduleSourcePosture,
    persistence: resolveRuntimePersistence(runtime),
    ...collectionAndHandlerFields,
    ...serviceAndMissionFields,
    ...referenceOptionsProviderFields,
    ...persistenceRuntimeFields,
    ...moduleSettingsRuntimeFields,
    items: buildRuntimeModuleItems(registry)
  };
}
