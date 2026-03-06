import {
  buildModuleLifecycleErrorResult,
  createModuleLifecycleActions,
  persistModuleRuntimeStateIfConfigured,
  resolveActiveCollectionDefinitions,
  resolveActiveCollectionSchemaById,
  resolveReferenceModulesListingData,
  resolveReferenceModulesRuntimeData
} from "./metadata-runtime-domain-service.js";
import {
  resolveRouteModuleId
} from "../../runtime/services/reference-module-id-translation-route-resolution-domain-service.js";

function registerModulesListingRoute({
  fastify,
  moduleRegistry,
  moduleRuntime,
  resolveCollectionResolution,
  resolveCollectionHandlerResolution,
  resolveServiceResolution,
  resolveMissionResolution,
  resolveReferenceOptionsProviderResolution,
  resolvePersistenceResolution,
  resolveModuleSettingsResolution,
  buildModuleNavigationItems
}) {
  fastify.get("/api/reference/modules", async () => {
    const listing = resolveReferenceModulesListingData({
      moduleRegistry,
      moduleRuntime,
      resolveCollectionResolution,
      resolveCollectionHandlerResolution,
      resolveServiceResolution,
      resolveMissionResolution,
      resolveReferenceOptionsProviderResolution,
      resolvePersistenceResolution,
      resolveModuleSettingsResolution,
      buildModuleNavigationItems
    });

    return {
      ok: true,
      items: listing.items,
      runtimeOk: listing.runtimeOk,
      diagnosticsCount: listing.diagnosticsCount,
      timestamp: new Date().toISOString()
    };
  });
}

function registerModulesRuntimeRoute({
  fastify,
  moduleRuntime,
  moduleRegistry,
  resolveCollectionResolution,
  resolveCollectionHandlerResolution,
  resolveServiceResolution,
  resolveMissionResolution,
  resolveReferenceOptionsProviderResolution,
  resolvePersistenceResolution,
  resolveModuleSettingsResolution,
  buildModuleRuntimePayload
}) {
  fastify.get("/api/reference/modules/runtime", async () => {
    const runtime = resolveReferenceModulesRuntimeData({
      moduleRuntime,
      moduleRegistry,
      resolveCollectionResolution,
      resolveCollectionHandlerResolution,
      resolveServiceResolution,
      resolveMissionResolution,
      resolveReferenceOptionsProviderResolution,
      resolvePersistenceResolution,
      resolveModuleSettingsResolution,
      buildModuleRuntimePayload
    });

    return {
      ok: true,
      runtime,
      timestamp: new Date().toISOString()
    };
  });
}

function registerModuleLifecycleRoutes({
  fastify,
  lifecycleActions,
  moduleRegistry,
  moduleRuntime,
  persistModuleRuntimeState,
  moduleIdTranslation
}) {
  for (const [action, run] of Object.entries(lifecycleActions)) {
    fastify.post(`/api/reference/modules/:moduleId/${action}`, async (request, reply) => {
      const moduleIdResolution = resolveRouteModuleId({
        requestedModuleId: request.params?.moduleId,
        moduleIdTranslation
      });
      if (!moduleIdResolution.ok) {
        reply.code(moduleIdResolution.statusCode);
        return moduleIdResolution.payload;
      }

      const moduleId = moduleIdResolution.moduleId;
      const beforeState = moduleRegistry.getState(moduleId);

      try {
        await run(moduleId);
      } catch (error) {
        const lifecycleError = buildModuleLifecycleErrorResult({
          action,
          moduleId,
          beforeState,
          error,
          moduleRegistry
        });
        reply.code(lifecycleError.statusCode);
        return lifecycleError.payload;
      }

      try {
        await persistModuleRuntimeStateIfConfigured({
          persistModuleRuntimeState,
          moduleRuntime
        });
      } catch (error) {
        const lifecycleError = buildModuleLifecycleErrorResult({
          action,
          moduleId,
          beforeState,
          error,
          moduleRegistry
        });
        reply.code(lifecycleError.statusCode);
        return lifecycleError.payload;
      }

      return {
        ok: true,
        action,
        moduleId,
        state: {
          before: beforeState ?? null,
          after: moduleRegistry.getState(moduleId) ?? null
        },
        timestamp: new Date().toISOString()
      };
    });
  }
}

function registerCollectionMetadataRoutes({
  fastify,
  resolveCollectionResolution,
  buildCollectionsPayload,
  getCollectionDefinition
}) {
  fastify.get("/api/reference/collections", async () => {
    const activeDefinitions = resolveActiveCollectionDefinitions(
      resolveCollectionResolution
    );

    return {
      ok: true,
      items: buildCollectionsPayload(activeDefinitions),
      timestamp: new Date().toISOString()
    };
  });

  fastify.get("/api/reference/collections/:collectionId/schema", async (request, reply) => {
    const collectionId = request.params?.collectionId;
    const definition = resolveActiveCollectionSchemaById({
      resolveCollectionResolution,
      getCollectionDefinition,
      collectionId
    });
    if (!definition) {
      reply.code(404);
      return {
        ok: false,
        error: {
          code: "COLLECTION_NOT_FOUND",
          message: `Collection '${collectionId}' was not found`
        },
        timestamp: new Date().toISOString()
      };
    }

    return {
      ok: true,
      collection: definition,
      timestamp: new Date().toISOString()
    };
  });
}

export function registerReferenceMetadataRouteHandlers({
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
  const lifecycleActions = createModuleLifecycleActions({
    moduleLoader,
    moduleRegistry
  });

  registerModulesListingRoute({
    fastify,
    moduleRegistry,
    moduleRuntime,
    resolveCollectionResolution,
    resolveCollectionHandlerResolution,
    resolveServiceResolution,
    resolveMissionResolution,
    resolveReferenceOptionsProviderResolution,
    resolvePersistenceResolution,
    resolveModuleSettingsResolution,
    buildModuleNavigationItems
  });
  registerModulesRuntimeRoute({
    fastify,
    moduleRuntime,
    moduleRegistry,
    resolveCollectionResolution,
    resolveCollectionHandlerResolution,
    resolveServiceResolution,
    resolveMissionResolution,
    resolveReferenceOptionsProviderResolution,
    resolvePersistenceResolution,
    resolveModuleSettingsResolution,
    buildModuleRuntimePayload
  });
  registerModuleLifecycleRoutes({
    fastify,
    lifecycleActions,
    moduleRegistry,
    moduleRuntime,
    persistModuleRuntimeState,
    moduleIdTranslation
  });
  registerCollectionMetadataRoutes({
    fastify,
    resolveCollectionResolution,
    buildCollectionsPayload,
    getCollectionDefinition
  });
}
