const REGISTRATION_TOP_LEVEL_FIELDS = new Set([
  "pluginId",
  "moduleId",
  "collections",
  "settings"
]);

const COLLECTION_DESCRIPTOR_FIELDS = new Set(["collectionId", "repository"]);
const SETTINGS_DESCRIPTOR_FIELDS = new Set(["repository"]);

function createDiagnostic(code, message, details = {}) {
  return {
    code,
    message,
    ...details
  };
}

function normalizeDiagnosticEntries(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({ ...entry }));
}

function isRepositoryContract(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.readState === "function" &&
    typeof value.transact === "function"
  );
}

function firstUnknownKey(input, allowedKeys) {
  return Object.keys(input ?? {}).find((key) => !allowedKeys.has(key)) ?? null;
}

function rejectRegistration(registrationDiagnostics, diagnostic) {
  registrationDiagnostics.push(diagnostic);
  return {
    ok: false,
    error: diagnostic
  };
}

function validateDefinitionDescriptor(definition, registrationDiagnostics) {
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
    const diagnostic = createDiagnostic(
      "PERSISTENCE_PLUGIN_REGISTRATION_INVALID",
      "Persistence plugin registration requires an object descriptor"
    );
    return rejectRegistration(registrationDiagnostics, diagnostic);
  }

  const unknownTopLevel = firstUnknownKey(definition, REGISTRATION_TOP_LEVEL_FIELDS);
  if (unknownTopLevel) {
    const diagnostic = createDiagnostic(
      "PERSISTENCE_PLUGIN_REGISTRATION_UNKNOWN_FIELD",
      `Persistence plugin registration field '${unknownTopLevel}' is not supported`,
      {
        field: unknownTopLevel,
        pluginId: definition.pluginId ?? null,
        moduleId: definition.moduleId ?? null
      }
    );
    return rejectRegistration(registrationDiagnostics, diagnostic);
  }

  return {
    ok: true,
    value: definition
  };
}

function resolvePluginIdentity(definition, plugins, registrationDiagnostics) {
  const pluginId = typeof definition.pluginId === "string" ? definition.pluginId.trim() : "";
  if (pluginId.length === 0) {
    const diagnostic = createDiagnostic(
      "PERSISTENCE_PLUGIN_REGISTRATION_INVALID",
      "Persistence plugin registration requires a non-empty pluginId",
      {
        moduleId: definition.moduleId ?? null
      }
    );
    return rejectRegistration(registrationDiagnostics, diagnostic);
  }

  const moduleId = typeof definition.moduleId === "string" ? definition.moduleId.trim() : "";
  if (moduleId.length === 0) {
    const diagnostic = createDiagnostic(
      "PERSISTENCE_PLUGIN_REGISTRATION_INVALID",
      `Persistence plugin '${pluginId}' requires a non-empty moduleId`,
      {
        pluginId
      }
    );
    return rejectRegistration(registrationDiagnostics, diagnostic);
  }

  if (plugins.has(pluginId)) {
    const diagnostic = createDiagnostic(
      "PERSISTENCE_PLUGIN_DUPLICATE",
      `Persistence plugin '${pluginId}' is already registered`,
      {
        pluginId,
        moduleId,
        firstModuleId: plugins.get(pluginId)?.moduleId ?? null
      }
    );
    return rejectRegistration(registrationDiagnostics, diagnostic);
  }

  return {
    ok: true,
    value: {
      pluginId,
      moduleId
    }
  };
}

function normalizeCollectionDescriptor({
  collectionDescriptor,
  index,
  pluginId,
  moduleId,
  collectionRepositories,
  registrationDiagnostics
}) {
  if (
    !collectionDescriptor ||
    typeof collectionDescriptor !== "object" ||
    Array.isArray(collectionDescriptor)
  ) {
    const diagnostic = createDiagnostic(
      "PERSISTENCE_PLUGIN_REGISTRATION_INVALID",
      `Persistence plugin '${pluginId}' collection descriptor at index ${index} must be an object`,
      {
        pluginId,
        moduleId,
        field: `collections.${index}`
      }
    );
    return rejectRegistration(registrationDiagnostics, diagnostic);
  }

  const unknownCollectionField = firstUnknownKey(
    collectionDescriptor,
    COLLECTION_DESCRIPTOR_FIELDS
  );
  if (unknownCollectionField) {
    const diagnostic = createDiagnostic(
      "PERSISTENCE_PLUGIN_REGISTRATION_UNKNOWN_FIELD",
      `Persistence plugin '${pluginId}' collection field '${unknownCollectionField}' is not supported`,
      {
        pluginId,
        moduleId,
        field: `collections.${index}.${unknownCollectionField}`
      }
    );
    return rejectRegistration(registrationDiagnostics, diagnostic);
  }

  const collectionId =
    typeof collectionDescriptor.collectionId === "string"
      ? collectionDescriptor.collectionId.trim()
      : "";
  if (collectionId.length === 0) {
    const diagnostic = createDiagnostic(
      "PERSISTENCE_PLUGIN_REGISTRATION_INVALID",
      `Persistence plugin '${pluginId}' collection descriptor requires a non-empty collectionId`,
      {
        pluginId,
        moduleId,
        field: `collections.${index}.collectionId`
      }
    );
    return rejectRegistration(registrationDiagnostics, diagnostic);
  }

  if (!isRepositoryContract(collectionDescriptor.repository)) {
    const diagnostic = createDiagnostic(
      "PERSISTENCE_PLUGIN_REGISTRATION_INVALID",
      `Persistence plugin '${pluginId}' collection '${collectionId}' requires a repository with readState/transact`,
      {
        pluginId,
        moduleId,
        collectionId,
        field: `collections.${index}.repository`
      }
    );
    return rejectRegistration(registrationDiagnostics, diagnostic);
  }

  if (collectionRepositories.has(collectionId)) {
    const existing = collectionRepositories.get(collectionId);
    const diagnostic = createDiagnostic(
      "PERSISTENCE_PLUGIN_COLLECTION_DUPLICATE",
      `Collection '${collectionId}' persistence repository is already registered`,
      {
        pluginId,
        moduleId,
        collectionId,
        firstPluginId: existing.pluginId ?? null,
        firstModuleId: existing.moduleId ?? null
      }
    );
    return rejectRegistration(registrationDiagnostics, diagnostic);
  }

  return {
    ok: true,
    value: {
      collectionId,
      repository: collectionDescriptor.repository
    }
  };
}

function normalizeCollectionDescriptors({
  definition,
  pluginId,
  moduleId,
  collectionRepositories,
  registrationDiagnostics
}) {
  if (definition.collections === undefined) {
    return {
      ok: true,
      value: []
    };
  }

  if (!Array.isArray(definition.collections)) {
    const diagnostic = createDiagnostic(
      "PERSISTENCE_PLUGIN_REGISTRATION_INVALID",
      `Persistence plugin '${pluginId}' collections must be an array`,
      {
        pluginId,
        moduleId,
        field: "collections"
      }
    );
    return rejectRegistration(registrationDiagnostics, diagnostic);
  }

  const normalizedCollections = [];
  for (const [index, collectionDescriptor] of definition.collections.entries()) {
    const normalizedCollection = normalizeCollectionDescriptor({
      collectionDescriptor,
      index,
      pluginId,
      moduleId,
      collectionRepositories,
      registrationDiagnostics
    });
    if (!normalizedCollection.ok) {
      return normalizedCollection;
    }
    normalizedCollections.push(normalizedCollection.value);
  }

  return {
    ok: true,
    value: normalizedCollections
  };
}

function normalizeSettingsDescriptor({
  definition,
  pluginId,
  moduleId,
  settingsRepositories,
  registrationDiagnostics
}) {
  if (definition.settings === undefined) {
    return {
      ok: true,
      value: null
    };
  }

  if (
    !definition.settings ||
    typeof definition.settings !== "object" ||
    Array.isArray(definition.settings)
  ) {
    const diagnostic = createDiagnostic(
      "PERSISTENCE_PLUGIN_REGISTRATION_INVALID",
      `Persistence plugin '${pluginId}' settings descriptor must be an object`,
      {
        pluginId,
        moduleId,
        field: "settings"
      }
    );
    return rejectRegistration(registrationDiagnostics, diagnostic);
  }

  const unknownSettingsField = firstUnknownKey(definition.settings, SETTINGS_DESCRIPTOR_FIELDS);
  if (unknownSettingsField) {
    const diagnostic = createDiagnostic(
      "PERSISTENCE_PLUGIN_REGISTRATION_UNKNOWN_FIELD",
      `Persistence plugin '${pluginId}' settings field '${unknownSettingsField}' is not supported`,
      {
        pluginId,
        moduleId,
        field: `settings.${unknownSettingsField}`
      }
    );
    return rejectRegistration(registrationDiagnostics, diagnostic);
  }

  if (!isRepositoryContract(definition.settings.repository)) {
    const diagnostic = createDiagnostic(
      "PERSISTENCE_PLUGIN_REGISTRATION_INVALID",
      `Persistence plugin '${pluginId}' settings descriptor requires a repository with readState/transact`,
      {
        pluginId,
        moduleId,
        field: "settings.repository"
      }
    );
    return rejectRegistration(registrationDiagnostics, diagnostic);
  }

  if (settingsRepositories.has(moduleId)) {
    const existing = settingsRepositories.get(moduleId);
    const diagnostic = createDiagnostic(
      "PERSISTENCE_PLUGIN_SETTINGS_DUPLICATE",
      `Module '${moduleId}' settings repository is already registered`,
      {
        pluginId,
        moduleId,
        firstPluginId: existing.pluginId ?? null
      }
    );
    return rejectRegistration(registrationDiagnostics, diagnostic);
  }

  return {
    ok: true,
    value: {
      repository: definition.settings.repository
    }
  };
}

function persistPluginRegistration({
  plugins,
  collectionRepositories,
  settingsRepositories,
  pluginId,
  moduleId,
  normalizedCollections,
  normalizedSettings
}) {
  plugins.set(pluginId, {
    pluginId,
    moduleId,
    collections: normalizedCollections.map((entry) => ({
      collectionId: entry.collectionId
    })),
    settings: normalizedSettings ? { enabled: true } : null
  });

  for (const collectionEntry of normalizedCollections) {
    collectionRepositories.set(collectionEntry.collectionId, {
      pluginId,
      moduleId,
      repository: collectionEntry.repository
    });
  }

  if (normalizedSettings) {
    settingsRepositories.set(moduleId, {
      pluginId,
      moduleId,
      repository: normalizedSettings.repository
    });
  }
}

function registerPersistencePlugin(state, definition) {
  const validatedDefinition = validateDefinitionDescriptor(definition, state.registrationDiagnostics);
  if (!validatedDefinition.ok) {
    return validatedDefinition;
  }

  const identity = resolvePluginIdentity(
    validatedDefinition.value,
    state.plugins,
    state.registrationDiagnostics
  );
  if (!identity.ok) {
    return identity;
  }

  const normalizedCollections = normalizeCollectionDescriptors({
    definition: validatedDefinition.value,
    pluginId: identity.value.pluginId,
    moduleId: identity.value.moduleId,
    collectionRepositories: state.collectionRepositories,
    registrationDiagnostics: state.registrationDiagnostics
  });
  if (!normalizedCollections.ok) {
    return normalizedCollections;
  }

  const normalizedSettings = normalizeSettingsDescriptor({
    definition: validatedDefinition.value,
    pluginId: identity.value.pluginId,
    moduleId: identity.value.moduleId,
    settingsRepositories: state.settingsRepositories,
    registrationDiagnostics: state.registrationDiagnostics
  });
  if (!normalizedSettings.ok) {
    return normalizedSettings;
  }

  persistPluginRegistration({
    plugins: state.plugins,
    collectionRepositories: state.collectionRepositories,
    settingsRepositories: state.settingsRepositories,
    pluginId: identity.value.pluginId,
    moduleId: identity.value.moduleId,
    normalizedCollections: normalizedCollections.value,
    normalizedSettings: normalizedSettings.value
  });

  return {
    ok: true
  };
}

function listPersistencePlugins(plugins) {
  return [...plugins.values()]
    .map((entry) => ({
      pluginId: entry.pluginId,
      moduleId: entry.moduleId,
      collections: entry.collections.map((collection) => ({ ...collection })),
      settings: entry.settings ? { ...entry.settings } : null
    }))
    .sort((left, right) => left.pluginId.localeCompare(right.pluginId));
}

function resolvePersistenceStatus(state, options = {}) {
  const moduleRegistry = options.moduleRegistry ?? null;
  const diagnostics = [
    ...state.registrationDiagnostics,
    ...normalizeDiagnosticEntries(options.additionalDiagnostics)
  ];
  const entries = listPersistencePlugins(state.plugins);
  const pluginModuleMap = {};
  const collectionRepositoryModuleMap = {};
  const activeCollectionRepositoryModuleMap = {};
  const settingsRepositoryModuleMap = {};
  const activeSettingsRepositoryModuleMap = {};

  for (const entry of entries) {
    pluginModuleMap[entry.pluginId] = entry.moduleId;

    const moduleState = moduleRegistry ? moduleRegistry.getState(entry.moduleId) : "enabled";
    if (moduleRegistry && moduleState === null) {
      diagnostics.push(
        createDiagnostic(
          "PERSISTENCE_PLUGIN_MODULE_NOT_DISCOVERED",
          `Persistence plugin '${entry.pluginId}' module '${entry.moduleId}' is not discovered`,
          {
            pluginId: entry.pluginId,
            moduleId: entry.moduleId
          }
        )
      );
    }

    for (const collectionEntry of entry.collections) {
      collectionRepositoryModuleMap[collectionEntry.collectionId] = entry.moduleId;
      if (!moduleRegistry || moduleState === "enabled") {
        activeCollectionRepositoryModuleMap[collectionEntry.collectionId] = entry.moduleId;
      }
    }

    if (entry.settings?.enabled) {
      settingsRepositoryModuleMap[entry.moduleId] = entry.pluginId;
      if (!moduleRegistry || moduleState === "enabled") {
        activeSettingsRepositoryModuleMap[entry.moduleId] = entry.pluginId;
      }
    }
  }

  return {
    registeredPluginIds: entries.map((entry) => entry.pluginId),
    pluginModuleMap,
    collectionRepositoryModuleMap,
    activeCollectionRepositoryModuleMap,
    settingsRepositoryModuleMap,
    activeSettingsRepositoryModuleMap,
    diagnostics
  };
}

export function createPersistencePluginRegistry() {
  const state = {
    plugins: new Map(),
    collectionRepositories: new Map(),
    settingsRepositories: new Map(),
    registrationDiagnostics: []
  };

  return {
    register(definition) {
      return registerPersistencePlugin(state, definition);
    },
    getCollectionRepository(collectionId) {
      return state.collectionRepositories.get(collectionId)?.repository ?? null;
    },
    getSettingsRepository(moduleId) {
      return state.settingsRepositories.get(moduleId)?.repository ?? null;
    },
    list() {
      return listPersistencePlugins(state.plugins);
    },
    resolveStatus(options = {}) {
      return resolvePersistenceStatus(state, options);
    }
  };
}
