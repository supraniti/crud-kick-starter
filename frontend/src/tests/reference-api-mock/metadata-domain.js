import { vi } from "vitest";
import { isCollectionActive, resolveActiveCollectionIds } from "./state.js";
import {
  buildModuleSettingsReadPayload,
  buildRuntimePersistenceMaps,
  cloneRuntimeModule,
  findRuntimeModule,
  isModuleSettingsStateReady,
  lifecycleErrorResponse,
  lifecycleSuccessResponse,
  normalizeModuleSettingsValues,
  resolveModuleSettingsDefinition,
  validateSettingsPatch
} from "./metadata-domain-helpers.js";

function buildModuleNavigationItems(state) {
  const runtimeStateByModuleId = new Map(
    (state.moduleRuntime ?? []).map((moduleItem) => [
      moduleItem.id,
      typeof moduleItem?.state === "string" ? moduleItem.state : "unknown"
    ])
  );

  return (state.modules ?? []).map((moduleItem) => {
    const moduleState = runtimeStateByModuleId.get(moduleItem.id) ?? "unknown";
    return {
      ...moduleItem,
      state: moduleState,
      routeAvailability: {
        policy: "visible-but-unavailable",
        visible: true,
        routeAvailable: moduleState === "enabled",
        state: moduleState
      }
    };
  });
}

function createListModulesHandler(state) {
  return async () => ({
    ok: true,
    items: buildModuleNavigationItems(state)
  });
}

function createReadModulesRuntimeHandler(state) {
  return async () => {
    const moduleCollectionIds = [
      ...new Set(
        state.moduleRuntime.flatMap((item) => (Array.isArray(item.collectionIds) ? item.collectionIds : []))
      )
    ];
    const activeCollectionIds = resolveActiveCollectionIds(state);
    const persistenceMaps = buildRuntimePersistenceMaps(state);

    return {
      ok: true,
      runtime: {
        ok: true,
        modulesDir: "modules",
        diagnostics: [],
        collectionDiagnostics: [],
        referenceStatePersistence: {
          enabled: true,
          configuredMode: "memory",
          runtimeMode: "memory",
          allowMemoryFallback: false,
          failFast: true,
          mongoUriConfigured: true
        },
        moduleCollectionIds,
        activeCollectionIds,
        collectionRepositoryModuleMap: persistenceMaps.collectionRepositoryModuleMap,
        activeCollectionRepositoryModuleMap:
          persistenceMaps.activeCollectionRepositoryModuleMap,
        collectionRepositoryPolicyMap: persistenceMaps.collectionRepositoryPolicyMap,
        activeCollectionRepositoryPolicyMap:
          persistenceMaps.activeCollectionRepositoryPolicyMap,
        settingsRepositoryModuleMap: persistenceMaps.settingsRepositoryModuleMap,
        activeSettingsRepositoryModuleMap:
          persistenceMaps.activeSettingsRepositoryModuleMap,
        settingsRepositoryPolicyMap: persistenceMaps.settingsRepositoryPolicyMap,
        activeSettingsRepositoryPolicyMap:
          persistenceMaps.activeSettingsRepositoryPolicyMap,
        items: state.moduleRuntime.map(cloneRuntimeModule)
      }
    };
  };
}

function createListSettingsModulesHandler(state) {
  return async () => {
    const items = Object.values(state.moduleSettingsDefinitions ?? {})
      .map((definition) => ({
        moduleId: definition.moduleId,
        state: findRuntimeModule(state, definition.moduleId)?.state ?? "unknown",
        fieldCount: definition.fields?.length ?? 0
      }))
      .sort((left, right) => left.moduleId.localeCompare(right.moduleId));

    return {
      ok: true,
      items,
      diagnostics: [],
      timestamp: "2026-02-14T00:00:00.000Z"
    };
  };
}

function createReadModuleSettingsHandler(state) {
  return async ({ moduleId }) => {
    const runtimeModule = findRuntimeModule(state, moduleId);
    if (!runtimeModule) {
      return {
        ok: false,
        error: {
          code: "MODULE_SETTINGS_NOT_FOUND",
          message: `Module '${moduleId}' does not declare settings`
        }
      };
    }

    if (!isModuleSettingsStateReady(runtimeModule.state)) {
      return {
        ok: false,
        error: {
          code: "MODULE_SETTINGS_MODULE_NOT_READY",
          message: `Module '${moduleId}' settings are unavailable while module state is '${runtimeModule.state}'`
        }
      };
    }

    const definition = resolveModuleSettingsDefinition(state, moduleId);
    if (!definition) {
      return {
        ok: false,
        error: {
          code: "MODULE_SETTINGS_NOT_FOUND",
          message: `Module '${moduleId}' does not declare settings`
        }
      };
    }

    return {
      ok: true,
      moduleId,
      state: runtimeModule.state,
      settings: buildModuleSettingsReadPayload(
        definition,
        state.moduleSettingsValues?.[moduleId] ?? {}
      ),
      timestamp: "2026-02-14T00:00:00.000Z"
    };
  };
}

function createUpdateModuleSettingsHandler(state) {
  return async ({ moduleId, settings }) => {
    const runtimeModule = findRuntimeModule(state, moduleId);
    if (!runtimeModule) {
      return {
        ok: false,
        error: {
          code: "MODULE_SETTINGS_NOT_FOUND",
          message: `Module '${moduleId}' does not declare settings`
        }
      };
    }

    if (!isModuleSettingsStateReady(runtimeModule.state)) {
      return {
        ok: false,
        error: {
          code: "MODULE_SETTINGS_MODULE_NOT_READY",
          message: `Module '${moduleId}' settings are unavailable while module state is '${runtimeModule.state}'`
        }
      };
    }

    const definition = resolveModuleSettingsDefinition(state, moduleId);
    if (!definition) {
      return {
        ok: false,
        error: {
          code: "MODULE_SETTINGS_NOT_FOUND",
          message: `Module '${moduleId}' does not declare settings`
        }
      };
    }

    const validated = validateSettingsPatch(definition, settings);
    if (!validated.ok) {
      return {
        ok: false,
        error: {
          code: validated.error.code,
          message: validated.error.message
        },
        validation: validated.error
      };
    }

    const currentValues = normalizeModuleSettingsValues(
      definition,
      state.moduleSettingsValues?.[moduleId] ?? {}
    );
    state.moduleSettingsValues[moduleId] = {
      ...currentValues,
      ...validated.patch
    };

    return {
      ok: true,
      moduleId,
      state: runtimeModule.state,
      settings: buildModuleSettingsReadPayload(
        definition,
        state.moduleSettingsValues[moduleId]
      ),
      timestamp: "2026-02-14T00:00:00.000Z"
    };
  };
}

function applyModuleLifecycleAction(state, action, moduleId) {
  const module = findRuntimeModule(state, moduleId);
  if (!module) {
    return lifecycleErrorResponse(
      state,
      action,
      moduleId,
      "MODULE_NOT_DISCOVERED",
      `Module ${moduleId} not discovered`
    );
  }

  if (
    (action === "enable" || action === "disable") &&
    (module.state === "discovered" || module.state === "uninstalled")
  ) {
    return lifecycleErrorResponse(
      state,
      action,
      moduleId,
      "MODULE_NOT_INSTALLED",
      `Module ${moduleId} is not installed`,
      module.state
    );
  }

  const beforeState = module.state;
  if (action === "install") {
    module.state = "installed";
  } else if (action === "uninstall") {
    module.state = "uninstalled";
  } else if (action === "enable") {
    module.state = "enabled";
  } else if (action === "disable") {
    module.state = "disabled";
  }
  return lifecycleSuccessResponse(action, moduleId, beforeState, module.state);
}

function createModuleLifecycleHandler(state, action) {
  return async ({ moduleId }) => applyModuleLifecycleAction(state, action, moduleId);
}

function createListCollectionsHandler(state) {
  return async () => {
    const activeCollectionIds = new Set(resolveActiveCollectionIds(state));
    const items = state.collections
      .filter((collection) => activeCollectionIds.has(collection.id))
      .map((collection) => ({ ...collection }));
    return { ok: true, items };
  };
}

function createReadCollectionSchemaHandler(state) {
  return async ({ collectionId }) => {
    if (!isCollectionActive(state, collectionId)) {
      return {
        ok: false,
        error: {
          code: "COLLECTION_NOT_FOUND",
          message: `Collection '${collectionId}' was not found`
        }
      };
    }

    const collection = state.collectionSchemas?.[collectionId] ?? null;
    if (!collection) {
      return {
        ok: false,
        error: {
          code: "COLLECTION_NOT_FOUND",
          message: `Collection '${collectionId}' was not found`
        }
      };
    }

    return {
      ok: true,
      collection: {
        ...collection,
        fields: collection.fields.map((field) => ({ ...field }))
      }
    };
  };
}

export function buildMetadataApi(state) {
  return {
    ping: vi.fn().mockResolvedValue({ ok: true }),
    listModules: vi.fn().mockImplementation(createListModulesHandler(state)),
    readModulesRuntime: vi.fn().mockImplementation(createReadModulesRuntimeHandler(state)),
    listSettingsModules: vi.fn().mockImplementation(createListSettingsModulesHandler(state)),
    readModuleSettings: vi.fn().mockImplementation(createReadModuleSettingsHandler(state)),
    updateModuleSettings: vi.fn().mockImplementation(createUpdateModuleSettingsHandler(state)),
    installModule: vi.fn().mockImplementation(createModuleLifecycleHandler(state, "install")),
    uninstallModule: vi.fn().mockImplementation(createModuleLifecycleHandler(state, "uninstall")),
    enableModule: vi.fn().mockImplementation(createModuleLifecycleHandler(state, "enable")),
    disableModule: vi.fn().mockImplementation(createModuleLifecycleHandler(state, "disable")),
    listCollections: vi.fn().mockImplementation(createListCollectionsHandler(state)),
    readCollectionSchema: vi.fn().mockImplementation(createReadCollectionSchemaHandler(state))
  };
}
