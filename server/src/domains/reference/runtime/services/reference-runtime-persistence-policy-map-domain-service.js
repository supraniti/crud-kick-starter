function normalizePolicyToken(value, fallback = "unknown") {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : fallback;
}

function normalizePolicyDescriptor(rawDescriptor = {}) {
  if (!rawDescriptor || typeof rawDescriptor !== "object" || Array.isArray(rawDescriptor)) {
    return null;
  }

  const configuredMode = normalizePolicyToken(
    rawDescriptor.configuredMode ?? rawDescriptor.mode,
    "unknown"
  );
  const runtimeMode = normalizePolicyToken(
    rawDescriptor.runtimeMode ?? rawDescriptor.mode,
    configuredMode
  );
  const source = normalizePolicyToken(rawDescriptor.source, "unknown");
  const stateFilePath =
    typeof rawDescriptor.stateFilePath === "string" && rawDescriptor.stateFilePath.length > 0
      ? rawDescriptor.stateFilePath
      : null;

  return {
    configuredMode,
    runtimeMode,
    source,
    stateFilePath
  };
}

function fallbackPolicyDescriptor() {
  return {
    configuredMode: "unknown",
    runtimeMode: "unknown",
    source: "unavailable",
    stateFilePath: null
  };
}

function resolveRepositoryPolicyDescriptor(repository, descriptorContext = {}) {
  if (!repository || typeof repository !== "object") {
    return {
      policy: fallbackPolicyDescriptor()
    };
  }

  if (typeof repository.describePolicy !== "function") {
    return {
      policy: fallbackPolicyDescriptor()
    };
  }

  let rawDescriptor;
  try {
    rawDescriptor = repository.describePolicy();
  } catch (error) {
    return {
      policy: fallbackPolicyDescriptor(),
      diagnostic: {
        code: "PERSISTENCE_REPOSITORY_POLICY_DESCRIBE_FAILED",
        message: `Persistence repository policy descriptor failed for '${descriptorContext.repositoryTarget ?? "unknown"}'`,
        moduleId: descriptorContext.moduleId ?? null,
        pluginId: descriptorContext.pluginId ?? null,
        collectionId: descriptorContext.collectionId ?? null,
        settingsModuleId: descriptorContext.settingsModuleId ?? null,
        errorMessage: error?.message ?? "Unknown policy describe failure"
      }
    };
  }

  const policy = normalizePolicyDescriptor(rawDescriptor);
  if (!policy) {
    return {
      policy: fallbackPolicyDescriptor(),
      diagnostic: {
        code: "PERSISTENCE_REPOSITORY_POLICY_DESCRIPTOR_INVALID",
        message: `Persistence repository policy descriptor for '${descriptorContext.repositoryTarget ?? "unknown"}' must be an object`,
        moduleId: descriptorContext.moduleId ?? null,
        pluginId: descriptorContext.pluginId ?? null,
        collectionId: descriptorContext.collectionId ?? null,
        settingsModuleId: descriptorContext.settingsModuleId ?? null
      }
    };
  }

  return {
    policy
  };
}

function isModuleEnabled(moduleRegistry, moduleId) {
  if (!moduleRegistry || typeof moduleRegistry.getState !== "function") {
    return true;
  }

  return moduleRegistry.getState(moduleId) === "enabled";
}

function buildCollectionPluginMap(pluginList = []) {
  const collectionPluginMap = {};
  for (const entry of pluginList) {
    for (const collection of entry?.collections ?? []) {
      if (typeof collection?.collectionId === "string") {
        collectionPluginMap[collection.collectionId] = entry.pluginId ?? null;
      }
    }
  }
  return collectionPluginMap;
}

function resolveCollectionRepositoryPolicyMaps({
  collectionRepositoryModuleMap,
  collectionPluginMap,
  persistencePluginRegistry,
  moduleRegistry
}) {
  const collectionRepositoryPolicyMap = {};
  const activeCollectionRepositoryPolicyMap = {};
  const diagnostics = [];
  const getCollectionRepository =
    typeof persistencePluginRegistry.getCollectionRepository === "function"
      ? persistencePluginRegistry.getCollectionRepository.bind(persistencePluginRegistry)
      : null;

  for (const collectionId of Object.keys(collectionRepositoryModuleMap).sort()) {
    const moduleId = collectionRepositoryModuleMap[collectionId] ?? null;
    const pluginId = collectionPluginMap[collectionId] ?? null;
    const repository = getCollectionRepository ? getCollectionRepository(collectionId) : null;
    const { policy, diagnostic } = resolveRepositoryPolicyDescriptor(repository, {
      repositoryTarget: "collection",
      moduleId,
      pluginId,
      collectionId
    });
    collectionRepositoryPolicyMap[collectionId] = policy;

    if (isModuleEnabled(moduleRegistry, moduleId)) {
      activeCollectionRepositoryPolicyMap[collectionId] = policy;
    }

    if (diagnostic) {
      diagnostics.push(diagnostic);
    }
  }

  return {
    collectionRepositoryPolicyMap,
    activeCollectionRepositoryPolicyMap,
    diagnostics
  };
}

function resolveSettingsRepositoryPolicyMaps({
  settingsRepositoryModuleMap,
  persistencePluginRegistry,
  moduleRegistry
}) {
  const settingsRepositoryPolicyMap = {};
  const activeSettingsRepositoryPolicyMap = {};
  const diagnostics = [];
  const getSettingsRepository =
    typeof persistencePluginRegistry.getSettingsRepository === "function"
      ? persistencePluginRegistry.getSettingsRepository.bind(persistencePluginRegistry)
      : null;

  for (const settingsModuleId of Object.keys(settingsRepositoryModuleMap).sort()) {
    const pluginId = settingsRepositoryModuleMap[settingsModuleId] ?? null;
    const repository = getSettingsRepository ? getSettingsRepository(settingsModuleId) : null;
    const { policy, diagnostic } = resolveRepositoryPolicyDescriptor(repository, {
      repositoryTarget: "settings",
      moduleId: settingsModuleId,
      pluginId,
      settingsModuleId
    });
    settingsRepositoryPolicyMap[settingsModuleId] = policy;

    if (isModuleEnabled(moduleRegistry, settingsModuleId)) {
      activeSettingsRepositoryPolicyMap[settingsModuleId] = policy;
    }

    if (diagnostic) {
      diagnostics.push(diagnostic);
    }
  }

  return {
    settingsRepositoryPolicyMap,
    activeSettingsRepositoryPolicyMap,
    diagnostics
  };
}

export function augmentPersistenceResolutionWithPolicyMaps(
  baseResolution = {},
  {
    persistencePluginRegistry = null,
    moduleRegistry = null
  } = {}
) {
  const collectionRepositoryPolicyMap = {};
  const activeCollectionRepositoryPolicyMap = {};
  const settingsRepositoryPolicyMap = {};
  const activeSettingsRepositoryPolicyMap = {};
  const diagnostics = Array.isArray(baseResolution?.diagnostics)
    ? [...baseResolution.diagnostics]
    : [];

  if (!persistencePluginRegistry || typeof persistencePluginRegistry !== "object") {
    return {
      ...baseResolution,
      collectionRepositoryPolicyMap,
      activeCollectionRepositoryPolicyMap,
      settingsRepositoryPolicyMap,
      activeSettingsRepositoryPolicyMap,
      diagnostics
    };
  }

  const pluginList =
    typeof persistencePluginRegistry.list === "function"
      ? persistencePluginRegistry.list()
      : [];
  const collectionPluginMap = buildCollectionPluginMap(pluginList);
  const collectionRepositoryModuleMap = baseResolution?.collectionRepositoryModuleMap ?? {};
  const collectionPolicies = resolveCollectionRepositoryPolicyMaps({
    collectionRepositoryModuleMap,
    collectionPluginMap,
    persistencePluginRegistry,
    moduleRegistry
  });

  const settingsRepositoryModuleMap = baseResolution?.settingsRepositoryModuleMap ?? {};
  const settingsPolicies = resolveSettingsRepositoryPolicyMaps({
    settingsRepositoryModuleMap,
    persistencePluginRegistry,
    moduleRegistry
  });
  Object.assign(collectionRepositoryPolicyMap, collectionPolicies.collectionRepositoryPolicyMap);
  Object.assign(
    activeCollectionRepositoryPolicyMap,
    collectionPolicies.activeCollectionRepositoryPolicyMap
  );
  Object.assign(settingsRepositoryPolicyMap, settingsPolicies.settingsRepositoryPolicyMap);
  Object.assign(
    activeSettingsRepositoryPolicyMap,
    settingsPolicies.activeSettingsRepositoryPolicyMap
  );
  diagnostics.push(...collectionPolicies.diagnostics, ...settingsPolicies.diagnostics);

  return {
    ...baseResolution,
    collectionRepositoryPolicyMap,
    activeCollectionRepositoryPolicyMap,
    settingsRepositoryPolicyMap,
    activeSettingsRepositoryPolicyMap,
    diagnostics
  };
}
