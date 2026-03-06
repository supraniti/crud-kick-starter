import {
  DELETE_POLICY_NULLIFY,
  DELETE_POLICY_RESTRICT,
  badRequestWithConflicts,
  collectionPersistenceFailedPayload,
  deleteRestrictedPayload,
  itemNotFoundPayload
} from "./reference-collection-route-shared-domain-service.js";
import {
  buildWorkspacePayload,
  resolveCollectionAccess,
  resolveWorkspaceReferenceOptions
} from "./reference-collection-workspace-domain-service.js";
import {
  applyNullifyDependencies,
  resolveReferenceDeleteDependencies
} from "./reference-collection-delete-dependencies-domain-service.js";

function resolveDeployStateRepository(deployStateRepository) {
  return deployStateRepository &&
    typeof deployStateRepository.readState === "function" &&
    typeof deployStateRepository.transact === "function"
    ? deployStateRepository
    : null;
}

function createDeployMarker(repository, state, markDeployRequired, toDeployStatePayload) {
  return async function markDeployRequiredAndReadPayload() {
    if (repository) {
      return repository.transact(async (workingState) => {
        markDeployRequired(workingState);
        return {
          commit: true,
          value: toDeployStatePayload(workingState)
        };
      });
    }

    markDeployRequired(state);
    return toDeployStatePayload(state);
  };
}

function resolveAccessOrNotFound({
  reply,
  collectionId,
  resolveActiveCollectionResolution,
  collectionHandlerRegistry
}) {
  const access = resolveCollectionAccess({
    collectionId,
    resolveActiveCollectionResolution,
    collectionHandlerRegistry
  });
  if (!access.ok) {
    reply.code(404);
    return {
      ok: false,
      payload: access.payload
    };
  }

  return {
    ok: true,
    access
  };
}

async function validateQueryOrBadRequest(reply, access, query) {
  if (typeof access.handler.validateQuery !== "function") {
    return {
      ok: true
    };
  }

  const queryValidation = await access.handler.validateQuery(query ?? {});
  if (queryValidation?.ok) {
    return {
      ok: true
    };
  }

  return {
    ok: false,
    payload: badRequestWithConflicts(
      reply,
      queryValidation?.errors ?? [],
      "COLLECTION_FILTER_UNSUPPORTED"
    )
  };
}

async function runAfterMutationOrFail({
  reply,
  access,
  action,
  collectionId,
  itemId,
  operationLabel
}) {
  if (typeof access.handler.afterMutation !== "function") {
    return {
      ok: true
    };
  }

  try {
    await access.handler.afterMutation({
      action,
      collectionId,
      itemId
    });
    return {
      ok: true
    };
  } catch (error) {
    reply.code(500);
    return {
      ok: false,
      payload: collectionPersistenceFailedPayload(collectionId, operationLabel, error)
    };
  }
}

async function markDeployAndReturnPayload({
  reply,
  collectionId,
  operationLabel,
  markDeployRequiredAndReadPayload
}) {
  try {
    const deployPayload = await markDeployRequiredAndReadPayload();
    return {
      ok: true,
      deployPayload
    };
  } catch (error) {
    reply.code(500);
    return {
      ok: false,
      payload: collectionPersistenceFailedPayload(collectionId, operationLabel, error)
    };
  }
}

function registerWorkspaceRoute({
  fastify,
  state,
  resolveActiveCollectionResolution,
  collectionHandlerRegistry,
  referenceOptionsProviderRegistry,
  moduleRegistry,
  referenceOptionsProviderPolicy
}) {
  fastify.get("/api/reference/collections/:collectionId/workspace", async (request, reply) => {
    const collectionId = request.params?.collectionId;
    const accessResult = resolveAccessOrNotFound({
      reply,
      collectionId,
      resolveActiveCollectionResolution,
      collectionHandlerRegistry
    });
    if (!accessResult.ok) {
      return accessResult.payload;
    }

    const queryValidation = await validateQueryOrBadRequest(reply, accessResult.access, request.query);
    if (!queryValidation.ok) {
      return queryValidation.payload;
    }

    let listPayload;
    try {
      listPayload = await accessResult.access.handler.list(request.query ?? {});
    } catch (error) {
      reply.code(500);
      return collectionPersistenceFailedPayload(collectionId, "workspace-read", error);
    }

    let referenceOptions;
    try {
      referenceOptions = await resolveWorkspaceReferenceOptions({
        activeCollections: accessResult.access.activeCollections,
        state,
        definition: accessResult.access.definition,
        collectionHandlerRegistry,
        referenceOptionsProviderRegistry,
        moduleRegistry,
        referenceOptionsProviderPolicy
      });
    } catch (error) {
      reply.code(500);
      return collectionPersistenceFailedPayload(collectionId, "workspace-options-read", error);
    }

    return buildWorkspacePayload({
      collectionId,
      definition: accessResult.access.definition,
      listPayload,
      referenceOptions
    });
  });
}

function registerItemsListRoute({
  fastify,
  resolveActiveCollectionResolution,
  collectionHandlerRegistry
}) {
  fastify.get("/api/reference/collections/:collectionId/items", async (request, reply) => {
    const collectionId = request.params?.collectionId;
    const accessResult = resolveAccessOrNotFound({
      reply,
      collectionId,
      resolveActiveCollectionResolution,
      collectionHandlerRegistry
    });
    if (!accessResult.ok) {
      return accessResult.payload;
    }

    const queryValidation = await validateQueryOrBadRequest(reply, accessResult.access, request.query);
    if (!queryValidation.ok) {
      return queryValidation.payload;
    }

    const payload = await accessResult.access.handler.list(request.query ?? {});

    return {
      ok: true,
      collectionId,
      items: payload.items,
      meta: payload.meta,
      filters: payload.filters,
      timestamp: new Date().toISOString()
    };
  });
}

function registerItemReadRoute({
  fastify,
  resolveActiveCollectionResolution,
  collectionHandlerRegistry
}) {
  fastify.get("/api/reference/collections/:collectionId/items/:itemId", async (request, reply) => {
    const collectionId = request.params?.collectionId;
    const accessResult = resolveAccessOrNotFound({
      reply,
      collectionId,
      resolveActiveCollectionResolution,
      collectionHandlerRegistry
    });
    if (!accessResult.ok) {
      return accessResult.payload;
    }

    const itemId = request.params?.itemId;
    const item = await accessResult.access.handler.findById(itemId);
    if (!item) {
      reply.code(404);
      return itemNotFoundPayload(collectionId, itemId);
    }

    return {
      ok: true,
      collectionId,
      item: await accessResult.access.handler.resolveRow(item),
      timestamp: new Date().toISOString()
    };
  });
}

function registerItemCreateRoute({
  fastify,
  badRequest,
  markDeployRequiredAndReadPayload,
  resolveActiveCollectionResolution,
  collectionHandlerRegistry
}) {
  fastify.post("/api/reference/collections/:collectionId/items", async (request, reply) => {
    const collectionId = request.params?.collectionId;
    const accessResult = resolveAccessOrNotFound({
      reply,
      collectionId,
      resolveActiveCollectionResolution,
      collectionHandlerRegistry
    });
    if (!accessResult.ok) {
      return accessResult.payload;
    }

    const body = request.body ?? {};
    const validation = await accessResult.access.handler.validateInput(body);
    if (!validation.ok) {
      return badRequestWithConflicts(reply, validation.errors);
    }

    let createResult;
    try {
      createResult = await accessResult.access.handler.create({
        value: validation.value,
        reply
      });
    } catch (error) {
      reply.code(500);
      return collectionPersistenceFailedPayload(collectionId, "create", error);
    }
    if (!createResult.ok) {
      if (typeof createResult.statusCode === "number") {
        reply.code(createResult.statusCode);
      }

      return createResult.payload;
    }

    const mutationResult = await runAfterMutationOrFail({
      reply,
      access: accessResult.access,
      action: "create",
      collectionId,
      itemId: createResult.item?.id ?? null,
      operationLabel: "create"
    });
    if (!mutationResult.ok) {
      return mutationResult.payload;
    }

    const deployResult = await markDeployAndReturnPayload({
      reply,
      collectionId,
      operationLabel: "create",
      markDeployRequiredAndReadPayload
    });
    if (!deployResult.ok) {
      return deployResult.payload;
    }

    reply.code(201);
    return {
      ok: true,
      collectionId,
      item: await accessResult.access.handler.resolveRow(createResult.item),
      deploy: deployResult.deployPayload,
      timestamp: new Date().toISOString()
    };
  });
}

function registerItemUpdateRoute({
  fastify,
  badRequest,
  markDeployRequiredAndReadPayload,
  resolveActiveCollectionResolution,
  collectionHandlerRegistry
}) {
  fastify.put("/api/reference/collections/:collectionId/items/:itemId", async (request, reply) => {
    const collectionId = request.params?.collectionId;
    const accessResult = resolveAccessOrNotFound({
      reply,
      collectionId,
      resolveActiveCollectionResolution,
      collectionHandlerRegistry
    });
    if (!accessResult.ok) {
      return accessResult.payload;
    }

    const itemId = request.params?.itemId;
    const item = await accessResult.access.handler.findById(itemId);
    if (!item) {
      reply.code(404);
      return itemNotFoundPayload(collectionId, itemId);
    }

    const body = request.body ?? {};
    const validation = await accessResult.access.handler.validateInput(body, {
      partial: true
    });
    if (!validation.ok) {
      return badRequestWithConflicts(reply, validation.errors);
    }
    if (!accessResult.access.handler.hasAnyMutableField(body)) {
      return badRequest(
        reply,
        accessResult.access.handler.emptyUpdateCode,
        "At least one mutable field is required"
      );
    }

    let updateResult;
    try {
      updateResult = await accessResult.access.handler.update({
        body,
        value: validation.value,
        item,
        reply
      });
    } catch (error) {
      reply.code(500);
      return collectionPersistenceFailedPayload(collectionId, "update", error);
    }
    if (!updateResult.ok) {
      if (typeof updateResult.statusCode === "number") {
        reply.code(updateResult.statusCode);
      }

      return updateResult.payload;
    }

    const mutationResult = await runAfterMutationOrFail({
      reply,
      access: accessResult.access,
      action: "update",
      collectionId,
      itemId,
      operationLabel: "update"
    });
    if (!mutationResult.ok) {
      return mutationResult.payload;
    }

    const deployResult = await markDeployAndReturnPayload({
      reply,
      collectionId,
      operationLabel: "update",
      markDeployRequiredAndReadPayload
    });
    if (!deployResult.ok) {
      return deployResult.payload;
    }

    return {
      ok: true,
      collectionId,
      item: await accessResult.access.handler.resolveRow(updateResult.item),
      deploy: deployResult.deployPayload,
      timestamp: new Date().toISOString()
    };
  });
}

async function resolveDeleteCleanup({
  collectionId,
  itemId,
  activeCollections,
  resolveCollectionRepository,
  resolveSettingsRepository
}) {
  const deleteDependencies = await resolveReferenceDeleteDependencies({
    activeCollections,
    targetCollectionId: collectionId,
    targetItemId: itemId,
    resolveCollectionRepository,
    resolveSettingsRepository
  });

  const restrictDependencies = deleteDependencies.filter(
    (entry) => entry.policy === DELETE_POLICY_RESTRICT
  );
  if (restrictDependencies.length > 0) {
    return {
      ok: false,
      restrictDependencies
    };
  }

  const nullifyDependencies = deleteDependencies.filter(
    (entry) => entry.policy === DELETE_POLICY_NULLIFY
  );
  if (nullifyDependencies.length === 0) {
    return {
      ok: true,
      cleanup: null
    };
  }

  const cleanup = await applyNullifyDependencies({
    nullifyDependencies,
    targetItemId: itemId,
    resolveCollectionRepository
  });
  return {
    ok: true,
    cleanup
  };
}

function registerItemDeleteRoute({
  fastify,
  markDeployRequiredAndReadPayload,
  resolveActiveCollectionResolution,
  collectionHandlerRegistry,
  resolveCollectionRepository,
  resolveSettingsRepository
}) {
  fastify.delete("/api/reference/collections/:collectionId/items/:itemId", async (request, reply) => {
    const collectionId = request.params?.collectionId;
    const accessResult = resolveAccessOrNotFound({
      reply,
      collectionId,
      resolveActiveCollectionResolution,
      collectionHandlerRegistry
    });
    if (!accessResult.ok) {
      return accessResult.payload;
    }

    const itemId = request.params?.itemId;
    const index = await accessResult.access.handler.findIndex(itemId);
    if (index < 0) {
      reply.code(404);
      return itemNotFoundPayload(collectionId, itemId);
    }

    let cleanup = null;
    try {
      const cleanupResult = await resolveDeleteCleanup({
        collectionId,
        itemId,
        activeCollections: accessResult.access.activeCollections,
        resolveCollectionRepository,
        resolveSettingsRepository
      });

      if (!cleanupResult.ok) {
        reply.code(409);
        return deleteRestrictedPayload(collectionId, itemId, cleanupResult.restrictDependencies);
      }
      cleanup = cleanupResult.cleanup;
    } catch (error) {
      reply.code(500);
      return collectionPersistenceFailedPayload(collectionId, "delete", error);
    }

    try {
      await accessResult.access.handler.removeByIndex(index, itemId);
    } catch (error) {
      reply.code(500);
      return collectionPersistenceFailedPayload(collectionId, "delete", error);
    }

    const mutationResult = await runAfterMutationOrFail({
      reply,
      access: accessResult.access,
      action: "delete",
      collectionId,
      itemId,
      operationLabel: "delete"
    });
    if (!mutationResult.ok) {
      return mutationResult.payload;
    }

    const deployResult = await markDeployAndReturnPayload({
      reply,
      collectionId,
      operationLabel: "delete",
      markDeployRequiredAndReadPayload
    });
    if (!deployResult.ok) {
      return deployResult.payload;
    }

    return {
      ok: true,
      collectionId,
      removed: {
        id: itemId
      },
      ...(cleanup
        ? {
            cleanup: {
              policy: DELETE_POLICY_NULLIFY,
              referenceCount: cleanup.referenceCount,
              collections: cleanup.collections
            }
          }
        : {}),
      deploy: deployResult.deployPayload,
      timestamp: new Date().toISOString()
    };
  });
}

export function registerReferenceCollectionRoutes({
  fastify,
  state,
  deployStateRepository,
  badRequest,
  markDeployRequired,
  toDeployStatePayload,
  resolveActiveCollectionResolution,
  collectionHandlerRegistry,
  referenceOptionsProviderRegistry,
  moduleRegistry,
  referenceOptionsProviderPolicy,
  resolveCollectionRepository,
  resolveSettingsRepository
}) {
  const repository = resolveDeployStateRepository(deployStateRepository);
  const markDeployRequiredAndReadPayload = createDeployMarker(
    repository,
    state,
    markDeployRequired,
    toDeployStatePayload
  );

  registerWorkspaceRoute({
    fastify,
    state,
    resolveActiveCollectionResolution,
    collectionHandlerRegistry,
    referenceOptionsProviderRegistry,
    moduleRegistry,
    referenceOptionsProviderPolicy
  });
  registerItemsListRoute({
    fastify,
    resolveActiveCollectionResolution,
    collectionHandlerRegistry
  });
  registerItemReadRoute({
    fastify,
    resolveActiveCollectionResolution,
    collectionHandlerRegistry
  });
  registerItemCreateRoute({
    fastify,
    badRequest,
    markDeployRequiredAndReadPayload,
    resolveActiveCollectionResolution,
    collectionHandlerRegistry
  });
  registerItemUpdateRoute({
    fastify,
    badRequest,
    markDeployRequiredAndReadPayload,
    resolveActiveCollectionResolution,
    collectionHandlerRegistry
  });
  registerItemDeleteRoute({
    fastify,
    markDeployRequiredAndReadPayload,
    resolveActiveCollectionResolution,
    collectionHandlerRegistry,
    resolveCollectionRepository,
    resolveSettingsRepository
  });
}
