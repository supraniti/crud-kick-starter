import {
  registerReferenceMetadataRouteHandlers
} from "../../domains/reference/metadata/services/metadata-route-registration-domain-service.js";

export function registerReferenceMetadataRoutes({
  fastify,
  moduleRegistry,
  moduleLoader,
  moduleRuntime,
  persistModuleRuntimeState,
  moduleIdTranslation,
  resolveCollectionResolution,
  resolveCollectionHandlerResolution,
  resolveServiceResolution,
  resolveMissionResolution,
  resolveReferenceOptionsProviderResolution,
  resolvePersistenceResolution,
  resolveModuleSettingsResolution,
  buildModuleNavigationItems,
  buildModuleRuntimePayload,
  buildCollectionsPayload,
  getCollectionDefinition
}) {
  registerReferenceMetadataRouteHandlers({
    fastify,
    moduleRegistry,
    moduleLoader,
    moduleRuntime,
    persistModuleRuntimeState,
    moduleIdTranslation,
    resolveCollectionResolution,
    resolveCollectionHandlerResolution,
    resolveServiceResolution,
    resolveMissionResolution,
    resolveReferenceOptionsProviderResolution,
    resolvePersistenceResolution,
    resolveModuleSettingsResolution,
    buildModuleNavigationItems,
    buildModuleRuntimePayload,
    buildCollectionsPayload,
    getCollectionDefinition
  });
}
