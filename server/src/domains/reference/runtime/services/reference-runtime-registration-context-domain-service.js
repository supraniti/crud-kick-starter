import { discoverModulesFromDirectory } from "../../../../core/module-registry.js";
import {
  applyReferenceRuntimeSnapshot,
  buildReferenceRuntimeDiagnostics,
  persistReferenceRuntimeSnapshot
} from "./reference-runtime-bootstrap-domain-service.js";
import {
  buildReferenceModuleRuntimePayload,
  createReferenceRuntimeResolvers,
  registerReferenceRuntimeModuleContributions
} from "./reference-runtime-composition-domain-service.js";
import {
  createReferenceModuleIdTranslationLayerFromFile
} from "./reference-module-id-translation-domain-service.js";

async function bootstrapReferenceRuntime({
  fastify,
  options,
  createReferenceState,
  resolveReferenceStatePersistence,
  hydrateReferenceStateSlices,
  createReferenceRepositories,
  createJobsRuntime,
  registerReferenceStateCloseHook,
  createRuntimeInfrastructure
}) {
  const state = createReferenceState();
  const referenceStatePersistence = resolveReferenceStatePersistence(fastify, options);
  const { referenceStateHydration, remotesDeployHydration } = await hydrateReferenceStateSlices(
    referenceStatePersistence,
    state
  );
  const repositories = createReferenceRepositories(state, referenceStatePersistence);
  const jobsRuntime = await createJobsRuntime(repositories.jobsRepository);
  registerReferenceStateCloseHook(fastify, referenceStatePersistence);
  const infrastructure = createRuntimeInfrastructure(options);

  return {
    state,
    referenceStatePersistence,
    referenceStateHydration,
    remotesDeployHydration,
    repositories,
    jobsRuntime,
    infrastructure
  };
}

async function buildReferenceRuntimeState({
  infrastructure,
  referenceStateHydration,
  remotesDeployHydration,
  jobPersistenceDiagnostics
}) {
  const moduleDiscovery = await discoverModulesFromDirectory({
    modulesDir: infrastructure.modulesDir,
    loader: infrastructure.moduleLoader,
    autoInstall: true,
    autoEnable: true
  });
  const runtimeStateLoad = await infrastructure.moduleRuntimeStateStore.loadSnapshot();
  const runtimeDiagnostics = buildReferenceRuntimeDiagnostics({
    moduleDiscovery,
    runtimeStateLoad,
    referenceStateHydration,
    remotesDeployHydration,
    jobPersistenceDiagnostics
  });
  const runtimeStateAppliedCount = applyReferenceRuntimeSnapshot(
    infrastructure.moduleRuntimeStateStore,
    infrastructure.moduleRegistry,
    runtimeStateLoad,
    runtimeDiagnostics
  );
  const runtimeStatePersistResult = await persistReferenceRuntimeSnapshot(
    infrastructure.moduleRuntimeStateStore,
    infrastructure.moduleRegistry,
    runtimeDiagnostics
  );

  return {
    moduleDiscovery,
    runtimeStateLoad,
    runtimeDiagnostics,
    runtimeStateAppliedCount,
    runtimeStatePersistResult
  };
}

async function registerReferenceRuntimeContributions({
  state,
  repositories,
  jobsRuntime,
  infrastructure,
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
  return registerReferenceRuntimeModuleContributions({
    state,
    moduleRegistry: infrastructure.moduleRegistry,
    collectionHandlerRegistry: infrastructure.collectionHandlerRegistry,
    persistencePluginRegistry: infrastructure.persistencePluginRegistry,
    referenceOptionsProviderRegistry: infrastructure.referenceOptionsProviderRegistry,
    serviceRegistry: infrastructure.serviceRegistry,
    missionRegistry: infrastructure.missionRegistry,
    recordsNotesRepository: repositories.recordsNotesRepository,
    remotesDeployRepository: repositories.remotesDeployRepository,
    moduleSettingsRepository: repositories.moduleSettingsRepository,
    jobRunner: jobsRuntime.jobRunner,
    jobLogStore: jobsRuntime.jobLogStore,
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
  });
}

async function buildReferenceRuntimeRouteContext({
  runtimeBootstrap,
  referenceOptionsProviderPolicy,
  buildReferenceStatePersistenceSummary,
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
  resolveReferenceOptionsProviderLifecycleGate,
  resolveCollectionDefinitions,
  augmentPersistenceResolutionWithPolicyMaps,
  resolveModuleSettingsDefinitions
}) {
  const {
    state,
    referenceStatePersistence,
    referenceStateHydration,
    remotesDeployHydration,
    repositories,
    jobsRuntime,
    infrastructure
  } = runtimeBootstrap;

  const runtimeState = await buildReferenceRuntimeState({
    infrastructure,
    referenceStateHydration,
    remotesDeployHydration,
    jobPersistenceDiagnostics: jobsRuntime.jobPersistenceDiagnostics
  });
  const moduleIdTranslation = await createReferenceModuleIdTranslationLayerFromFile({
    mode: infrastructure.moduleIdTranslationMode,
    mapPath: infrastructure.moduleIdTranslationMapFile,
    moduleRegistry: infrastructure.moduleRegistry
  });
  const registration = await registerReferenceRuntimeContributions({
    state,
    repositories,
    jobsRuntime,
    infrastructure,
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
  });
  const moduleRuntime = buildReferenceModuleRuntimePayload({
    moduleDiscovery: runtimeState.moduleDiscovery,
    runtimeDiagnostics: runtimeState.runtimeDiagnostics,
    persistenceRegistration: registration.persistenceRegistration,
    collectionHandlerRegistration: registration.collectionHandlerRegistration,
    referenceOptionsProviderRegistration: registration.referenceOptionsProviderRegistration,
    serviceRegistration: registration.serviceRegistration,
    missionRegistration: registration.missionRegistration,
    referenceStatePersistenceSummary: buildReferenceStatePersistenceSummary(
      referenceStatePersistence
    ),
    referenceOptionsProviderPolicy,
    moduleIdTranslation,
    moduleRuntimeStateStore: infrastructure.moduleRuntimeStateStore,
    runtimeStateLoad: runtimeState.runtimeStateLoad,
    runtimeStateAppliedCount: runtimeState.runtimeStateAppliedCount,
    runtimeStatePersistResult: runtimeState.runtimeStatePersistResult
  });
  const resolvers = createReferenceRuntimeResolvers({
    moduleRegistry: infrastructure.moduleRegistry,
    collectionHandlerRegistry: infrastructure.collectionHandlerRegistry,
    persistencePluginRegistry: infrastructure.persistencePluginRegistry,
    serviceRegistry: infrastructure.serviceRegistry,
    missionRegistry: infrastructure.missionRegistry,
    referenceOptionsProviderRegistry: infrastructure.referenceOptionsProviderRegistry,
    persistenceRegistration: registration.persistenceRegistration,
    serviceRegistration: registration.serviceRegistration,
    missionRegistration: registration.missionRegistration,
    referenceOptionsProviderRegistration: registration.referenceOptionsProviderRegistration,
    resolveCollectionDefinitions,
    augmentPersistenceResolutionWithPolicyMaps,
    resolveModuleSettingsDefinitions
  });

  return {
    state,
    moduleRegistry: infrastructure.moduleRegistry,
    moduleLoader: infrastructure.moduleLoader,
    moduleRuntime,
    moduleRuntimeStateStore: infrastructure.moduleRuntimeStateStore,
    persistencePluginRegistry: infrastructure.persistencePluginRegistry,
    collectionHandlerRegistry: infrastructure.collectionHandlerRegistry,
    referenceOptionsProviderRegistry: infrastructure.referenceOptionsProviderRegistry,
    referenceOptionsProviderPolicy,
    moduleIdTranslation,
    remotesDeployRepository: repositories.remotesDeployRepository,
    missionRegistry: infrastructure.missionRegistry,
    serviceRegistry: infrastructure.serviceRegistry,
    jobRunner: jobsRuntime.jobRunner,
    jobLogStore: jobsRuntime.jobLogStore,
    pushJobLogWithPersistence: jobsRuntime.pushJobLogWithPersistence,
    resolvers
  };
}

export async function createReferenceRuntimeRegistrationContext({
  fastify,
  options,
  referenceOptionsProviderPolicy,
  createReferenceState,
  resolveReferenceStatePersistence,
  hydrateReferenceStateSlices,
  createReferenceRepositories,
  createJobsRuntime,
  registerReferenceStateCloseHook,
  createRuntimeInfrastructure,
  buildReferenceStatePersistenceSummary,
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
  resolveReferenceOptionsProviderLifecycleGate,
  resolveCollectionDefinitions,
  augmentPersistenceResolutionWithPolicyMaps,
  resolveModuleSettingsDefinitions
}) {
  const runtimeBootstrap = await bootstrapReferenceRuntime({
    fastify,
    options,
    createReferenceState,
    resolveReferenceStatePersistence,
    hydrateReferenceStateSlices,
    createReferenceRepositories,
    createJobsRuntime,
    registerReferenceStateCloseHook,
    createRuntimeInfrastructure
  });

  return buildReferenceRuntimeRouteContext({
    runtimeBootstrap,
    referenceOptionsProviderPolicy,
    buildReferenceStatePersistenceSummary,
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
    resolveReferenceOptionsProviderLifecycleGate,
    resolveCollectionDefinitions,
    augmentPersistenceResolutionWithPolicyMaps,
    resolveModuleSettingsDefinitions
  });
}
