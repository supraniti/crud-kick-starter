import { createCollectionHandlerRegistry } from "../../../../core/collection-handler-registry.js";
import { createMissionRegistry } from "../../../../core/mission-registry.js";
import { createPersistencePluginRegistry } from "../../../../core/persistence-plugin-registry.js";
import { createReferenceOptionsProviderRegistry } from "../../../../core/reference-options-provider-registry.js";
import { createServiceRegistry } from "../../../../core/service-registry.js";
import { createModuleLoader, createModuleRegistry } from "../../../../core/module-registry.js";
import { createReferenceJobsRuntime } from "./reference-runtime-bootstrap-domain-service.js";
import { resolveReferenceRuntimeDefaults } from "./reference-runtime-defaults-domain-service.js";
import { createModuleRuntimeStateStore } from "./reference-module-runtime-state-domain-service.js";
import {
  createJobsRepository,
  createModuleSettingsRepository,
  createRecordsNotesRepository,
  createReferenceStatePersistenceAdapter,
  createRemotesDeployRepository
} from "./reference-state-persistence-runtime-domain-service.js";
import { pushJobLog } from "../../remotes/services/reference-remote-deploy-runtime-domain-service.js";

function resolveReferenceStatePersistence(fastify, options = {}) {
  return (
    options.referenceStatePersistence ??
    createReferenceStatePersistenceAdapter({
      mongoUri: fastify.config?.mongoUri
    })
  );
}

async function hydrateReferenceStateSlices(referenceStatePersistence, state) {
  const referenceStateHydration = await referenceStatePersistence.hydrateState(state);
  const remotesDeployHydration =
    typeof referenceStatePersistence.hydrateRemotesDeployState === "function"
      ? await referenceStatePersistence.hydrateRemotesDeployState(state)
      : {
          ok: true,
          diagnostics: []
        };

  return {
    referenceStateHydration,
    remotesDeployHydration
  };
}

function createReferenceRepositories(state, referenceStatePersistence) {
  return {
    recordsNotesRepository: createRecordsNotesRepository({
      state,
      referenceStatePersistence
    }),
    remotesDeployRepository: createRemotesDeployRepository({
      state,
      referenceStatePersistence
    }),
    jobsRepository: createJobsRepository({
      referenceStatePersistence
    }),
    moduleSettingsRepository: createModuleSettingsRepository({
      referenceStatePersistence
    })
  };
}

function buildReferenceStatePersistenceSummary(referenceStatePersistence) {
  if (typeof referenceStatePersistence.describe === "function") {
    return referenceStatePersistence.describe();
  }

  return {
    enabled: referenceStatePersistence?.enabled === true,
    configuredMode: "unknown",
    runtimeMode:
      typeof referenceStatePersistence?.mode === "function"
        ? referenceStatePersistence.mode()
        : "unknown",
    allowMemoryFallback: null,
    failFast: null,
    mongoUriConfigured: null,
    mongoServerSelectionTimeoutMs: null,
    databaseName: null,
    collectionName: null,
    moduleSettingsDocumentId: null
  };
}

function registerReferenceStateCloseHook(fastify, referenceStatePersistence) {
  fastify.addHook("onClose", async () => {
    if (typeof referenceStatePersistence.close === "function") {
      await referenceStatePersistence.close();
    }
  });
}

async function createJobsRuntime(jobsRepository) {
  return createReferenceJobsRuntime({
    jobsRepository,
    pushJobLog
  });
}

function createRuntimeInfrastructure(options = {}) {
  const defaults = resolveReferenceRuntimeDefaults();
  const modulesDir = options.modulesDir ?? defaults.modulesRootDir;
  const moduleIdTranslationMapFile =
    options.moduleIdTranslationMapFile ?? defaults.moduleIdTranslationMapFile;
  const moduleIdTranslationMode =
    options.moduleIdTranslationMode ?? defaults.moduleIdTranslationModeDefault;
  const moduleRuntimeStateStore = createModuleRuntimeStateStore({
    stateFilePath: options.moduleRuntimeStateFile ?? defaults.moduleRuntimeStateFileDefault
  });
  const moduleRegistry = createModuleRegistry();
  const collectionHandlerRegistry = createCollectionHandlerRegistry();
  const persistencePluginRegistry = createPersistencePluginRegistry();
  const referenceOptionsProviderRegistry = createReferenceOptionsProviderRegistry();
  const serviceRegistry = createServiceRegistry();
  const missionRegistry = createMissionRegistry();
  const moduleLoader = createModuleLoader({
    registry: moduleRegistry
  });

  return {
    modulesDir,
    moduleIdTranslationMapFile,
    moduleIdTranslationMode,
    moduleRuntimeStateStore,
    moduleRegistry,
    collectionHandlerRegistry,
    persistencePluginRegistry,
    referenceOptionsProviderRegistry,
    serviceRegistry,
    missionRegistry,
    moduleLoader
  };
}

export {
  buildReferenceStatePersistenceSummary,
  createJobsRuntime,
  createReferenceRepositories,
  createRuntimeInfrastructure,
  hydrateReferenceStateSlices,
  registerReferenceStateCloseHook,
  resolveReferenceStatePersistence
};

