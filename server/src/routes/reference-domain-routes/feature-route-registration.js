import { registerReferenceCollectionRoutes } from "../../domains/reference/collections/services/reference-collection-route-runtime-domain-service.js";
import { evaluateSafeguard } from "../../core/safeguard-evaluator.js";
import { registerReferenceMetadataRoutes } from "./metadata-routes.js";
import { registerReferenceMissionRoutes } from "./mission-routes.js";
import { registerReferenceProductTaxonomyRoutes } from "./product-taxonomy-routes.js";
import { registerReferenceRemoteDeployRoutes } from "./remote-deploy-routes.js";
import { registerReferenceModuleSettingsRoutes } from "./settings-routes.js";
import {
  buildCollectionsPayload,
  buildModuleNavigationItems,
  buildModuleRuntimePayload,
  getCollectionDefinition
} from "../../domains/reference/runtime/services/reference-runtime-payload-domain-service.js";
import {
  buildProductsPipeline,
  buildTagDeleteImpact,
  buildTagDeleteSafeguard,
  buildTagsPayload,
  createTag,
  findTagByLabel,
  normalizeTagIds,
  resolveProductRow
} from "../../domains/reference/product-taxonomies/services/reference-product-taxonomy-runtime-domain-service.js";
import {
  buildRemotesPayload,
  executeRemoteDeploy,
  findRemoteById,
  generateDeployArtifacts,
  hasRemoteLabelConflict,
  nextRemoteId,
  toPublicJob,
  validateRemoteInput
} from "../../domains/reference/remotes/services/reference-remote-deploy-runtime-domain-service.js";
import {
  badRequest,
  cloneReferenceData,
  haveSameIds,
  markDeployRequired,
  toDeployStatePayload,
  uniqueIds
} from "../../domains/reference/runtime/services/reference-state-utils-domain-service.js";

function registerMetadataFeatureRoutes({
  fastify,
  moduleRegistry,
  moduleLoader,
  moduleRuntime,
  moduleIdTranslation,
  moduleRuntimeStateStore,
  resolvers,
  buildModuleNavigationItems,
  buildModuleRuntimePayload,
  buildCollectionsPayload,
  getCollectionDefinition
}) {
  registerReferenceMetadataRoutes({
    fastify,
    moduleRegistry,
    moduleLoader,
    moduleRuntime,
    moduleIdTranslation,
    persistModuleRuntimeState: async () =>
      moduleRuntimeStateStore.saveSnapshot(moduleRegistry),
    resolveCollectionResolution: resolvers.resolveCollectionResolution,
    resolveCollectionHandlerResolution: resolvers.resolveCollectionHandlerResolution,
    resolveServiceResolution: resolvers.resolveServiceResolution,
    resolveMissionResolution: resolvers.resolveMissionResolution,
    resolveReferenceOptionsProviderResolution:
      resolvers.resolveReferenceOptionsProviderResolution,
    resolvePersistenceResolution: resolvers.resolvePersistenceResolution,
    resolveModuleSettingsResolution: resolvers.resolveModuleSettingsResolution,
    buildModuleNavigationItems,
    buildModuleRuntimePayload,
    buildCollectionsPayload,
    getCollectionDefinition
  });
}

function registerModuleSettingsFeatureRoutes({
  fastify,
  moduleRegistry,
  moduleIdTranslation,
  resolvers,
  persistencePluginRegistry
}) {
  registerReferenceModuleSettingsRoutes({
    fastify,
    moduleRegistry,
    resolveModuleSettingsResolution: resolvers.resolveModuleSettingsResolution,
    moduleIdTranslation,
    resolveSettingsRepository: (moduleId) =>
      persistencePluginRegistry.getSettingsRepository(moduleId)
  });
}

function registerCollectionFeatureRoutes({
  fastify,
  state,
  remotesDeployRepository,
  resolvers,
  collectionHandlerRegistry,
  referenceOptionsProviderRegistry,
  moduleRegistry,
  referenceOptionsProviderPolicy,
  persistencePluginRegistry
}) {
  registerReferenceCollectionRoutes({
    fastify,
    state,
    deployStateRepository: remotesDeployRepository,
    badRequest,
    markDeployRequired,
    toDeployStatePayload,
    resolveActiveCollectionResolution: () =>
      resolvers.resolveCollectionResolution({ activeOnly: true }),
    collectionHandlerRegistry,
    referenceOptionsProviderRegistry,
    moduleRegistry,
    referenceOptionsProviderPolicy,
    resolveCollectionRepository: (collectionId) =>
      persistencePluginRegistry.getCollectionRepository(collectionId),
    resolveSettingsRepository: (moduleId) =>
      persistencePluginRegistry.getSettingsRepository(moduleId)
  });
}

function registerRemoteDeployFeatureRoutes({
  fastify,
  state,
  remotesDeployRepository,
  jobRunner,
  jobLogStore,
  deployOutputRoot,
  pushJobLogWithPersistence
}) {
  registerReferenceRemoteDeployRoutes({
    fastify,
    state,
    remotesDeployRepository,
    jobRunner,
    jobLogStore,
    buildRemotesPayload,
    validateRemoteInput,
    badRequest,
    hasRemoteLabelConflict,
    nextRemoteId,
    markDeployRequired,
    toDeployStatePayload,
    findRemoteById,
    toPublicJob,
    cloneReferenceData,
    generateDeployArtifacts: (snapshot, revision) =>
      generateDeployArtifacts(snapshot, revision, deployOutputRoot),
    executeRemoteDeploy,
    pushJobLog: pushJobLogWithPersistence
  });
}

function registerMissionFeatureRoutes({
  fastify,
  moduleRegistry,
  missionRegistry,
  serviceRegistry,
  jobRunner,
  jobLogStore,
  pushJobLogWithPersistence
}) {
  registerReferenceMissionRoutes({
    fastify,
    moduleRegistry,
    missionRegistry,
    serviceRegistry,
    jobRunner,
    jobLogStore,
    toPublicJob,
    pushJobLog: pushJobLogWithPersistence
  });
}

function registerProductTaxonomyFeatureRoutes({
  fastify,
  state,
  remotesDeployRepository
}) {
  registerReferenceProductTaxonomyRoutes({
    fastify,
    state,
    productsTaxonomiesRepository: remotesDeployRepository,
    evaluateSafeguard,
    buildTagsPayload,
    buildProductsPipeline,
    normalizeTagIds,
    findTagByLabel,
    createTag,
    uniqueIds,
    haveSameIds,
    markDeployRequired,
    resolveProductRow,
    buildTagDeleteImpact,
    buildTagDeleteSafeguard,
    badRequest
  });
}

export function registerReferenceFeatureRoutes({
  fastify,
  runtimeContext,
  deployOutputRoot
}) {
  const {
    state,
    moduleRegistry,
    moduleLoader,
    moduleRuntime,
    moduleIdTranslation,
    moduleRuntimeStateStore,
    persistencePluginRegistry,
    collectionHandlerRegistry,
    referenceOptionsProviderRegistry,
    referenceOptionsProviderPolicy,
    remotesDeployRepository,
    missionRegistry,
    serviceRegistry,
    jobRunner,
    jobLogStore,
    pushJobLogWithPersistence,
    resolvers
  } = runtimeContext;

  registerMetadataFeatureRoutes({
    fastify,
    moduleRegistry,
    moduleLoader,
    moduleRuntime,
    moduleIdTranslation,
    moduleRuntimeStateStore,
    resolvers,
    buildModuleNavigationItems,
    buildModuleRuntimePayload,
    buildCollectionsPayload,
    getCollectionDefinition
  });

  registerModuleSettingsFeatureRoutes({
    fastify,
    moduleRegistry,
    moduleIdTranslation,
    resolvers,
    persistencePluginRegistry
  });

  registerCollectionFeatureRoutes({
    fastify,
    state,
    remotesDeployRepository,
    resolvers,
    collectionHandlerRegistry,
    referenceOptionsProviderRegistry,
    moduleRegistry,
    referenceOptionsProviderPolicy,
    persistencePluginRegistry
  });

  registerRemoteDeployFeatureRoutes({
    fastify,
    state,
    remotesDeployRepository,
    jobRunner,
    jobLogStore,
    deployOutputRoot,
    pushJobLogWithPersistence
  });

  registerMissionFeatureRoutes({
    fastify,
    moduleRegistry,
    missionRegistry,
    serviceRegistry,
    jobRunner,
    jobLogStore,
    pushJobLogWithPersistence
  });

  registerProductTaxonomyFeatureRoutes({
    fastify,
    state,
    remotesDeployRepository
  });
}
