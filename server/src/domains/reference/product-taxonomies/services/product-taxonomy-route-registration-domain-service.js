import {
  buildProductTaxonomyPersistenceFailedPayload,
  createProductTagUpdateRunner,
  createTagDeleteRunner,
  resolveTagIdsFromRequestBody
} from "./product-taxonomy-domain-service.js";

function registerCategoriesRoute({ fastify, readWorkingState }) {
  fastify.get("/api/reference/categories", async () => {
    const workingState = await readWorkingState();
    return {
      ok: true,
      items: workingState.categories.map((category) => ({ ...category })),
      timestamp: new Date().toISOString()
    };
  });
}

function registerTagsListRoute({ fastify, readWorkingState, buildTagsPayload }) {
  fastify.get("/api/reference/taxonomies/tags", async () => {
    const workingState = await readWorkingState();
    return {
      ok: true,
      items: buildTagsPayload(workingState),
      timestamp: new Date().toISOString()
    };
  });
}

function registerProductsListRoute({
  fastify,
  readWorkingState,
  buildProductsPipeline
}) {
  fastify.get("/api/reference/products", async (request, reply) => {
    const workingState = await readWorkingState();
    const { pipeline, categoryIds, limit, offset } = buildProductsPipeline(
      workingState,
      request.query ?? {}
    );

    const result = await pipeline.run(workingState.products);
    if (!result.ok) {
      reply.code(500);
      return {
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
          stage: result.stage
        },
        timestamp: new Date().toISOString()
      };
    }

    return {
      ok: true,
      items: result.data,
      meta: {
        total: result.stageMeta.filter?.totalAfterFilter ?? result.data.length,
        offset,
        limit
      },
      filters: {
        applied: {
          categoryIds
        }
      },
      pipeline: {
        executedStages: result.executedStages
      },
      timestamp: new Date().toISOString()
    };
  });
}

function registerProductTagsUpdateRoute({
  fastify,
  mutateWorkingState,
  evaluateSafeguard,
  normalizeTagIds,
  findTagByLabel,
  createTag,
  uniqueIds,
  haveSameIds,
  markDeployRequired,
  resolveProductRow
}) {
  const runProductTagUpdate = createProductTagUpdateRunner({
    mutateWorkingState,
    evaluateSafeguard,
    normalizeTagIds,
    findTagByLabel,
    createTag,
    uniqueIds,
    haveSameIds,
    markDeployRequired,
    resolveProductRow
  });

  fastify.post("/api/reference/products/:id/tags", async (request, reply) => {
    const productId = request.params?.id;
    const body = request.body ?? {};
    const requestedTagIds = Array.isArray(body.tagIds) ? body.tagIds : [];
    const newTagLabel = typeof body.newTagLabel === "string" ? body.newTagLabel.trim() : "";
    const approveNewTag = body.approveNewTag === true;

    let updateResult;
    try {
      updateResult = await runProductTagUpdate({
        productId,
        requestedTagIds,
        newTagLabel,
        approveNewTag
      });
    } catch (error) {
      reply.code(500);
      return buildProductTaxonomyPersistenceFailedPayload("product-tags-update", error);
    }

    if (!updateResult.ok) {
      if (typeof updateResult.statusCode === "number") {
        reply.code(updateResult.statusCode);
      }

      return updateResult.payload;
    }

    return {
      ok: true,
      item: updateResult.item,
      meta: updateResult.meta,
      timestamp: new Date().toISOString()
    };
  });
}

function registerTagsImpactRoute({
  fastify,
  readWorkingState,
  normalizeTagIds,
  buildTagDeleteImpact,
  buildTagDeleteSafeguard,
  badRequest
}) {
  fastify.post("/api/reference/taxonomies/tags/impact", async (request, reply) => {
    const incomingTagIds = resolveTagIdsFromRequestBody(request.body ?? {});
    const workingState = await readWorkingState();
    const tagIds = normalizeTagIds(workingState, incomingTagIds);
    if (tagIds.length === 0) {
      return badRequest(reply, "TAG_IDS_REQUIRED", "At least one existing tag id is required");
    }

    const impact = buildTagDeleteImpact(workingState, tagIds);
    const safeguard = buildTagDeleteSafeguard(tagIds, impact);

    return {
      ok: true,
      taxonomyType: "tags",
      tagIds,
      impact,
      safeguard,
      timestamp: new Date().toISOString()
    };
  });
}

function registerTagDeleteRoute({
  fastify,
  mutateWorkingState,
  normalizeTagIds,
  buildTagDeleteImpact,
  buildTagDeleteSafeguard,
  buildTagsPayload,
  markDeployRequired
}) {
  const runTagDelete = createTagDeleteRunner({
    mutateWorkingState,
    normalizeTagIds,
    buildTagDeleteImpact,
    buildTagDeleteSafeguard,
    buildTagsPayload,
    markDeployRequired
  });

  fastify.post("/api/reference/taxonomies/tags/delete", async (request, reply) => {
    const body = request.body ?? {};
    const incomingTagIds = resolveTagIdsFromRequestBody(body);
    const approved = body.approved === true;

    let deleteResult;
    try {
      deleteResult = await runTagDelete(incomingTagIds, approved);
    } catch (error) {
      reply.code(500);
      return buildProductTaxonomyPersistenceFailedPayload("taxonomy-tags-delete", error);
    }

    if (!deleteResult.ok) {
      if (typeof deleteResult.statusCode === "number") {
        reply.code(deleteResult.statusCode);
      }

      return deleteResult.payload;
    }

    return {
      ok: true,
      removed: deleteResult.removed,
      cleanup: deleteResult.cleanup,
      remainingTags: deleteResult.remainingTags,
      timestamp: new Date().toISOString()
    };
  });
}

function registerSafeguardPreviewRoute({ fastify, evaluateSafeguard }) {
  fastify.get("/api/reference/safeguards/preview", async (request) => {
    const value = typeof request.query?.value === "string" ? request.query.value : "";
    const action =
      typeof request.query?.action === "string" && request.query.action.length > 0
        ? request.query.action
        : "create-tag";

    const dependentCount = value.length > 0 ? 1 : 0;
    const safeguard = evaluateSafeguard({
      action,
      entityType: "tag",
      entityId: value.length > 0 ? value.toLowerCase().replace(/\s+/g, "-") : "new-tag",
      impact: {
        dependentCount,
        dependentIds: dependentCount > 0 ? ["prd-001"] : []
      }
    });

    return {
      ok: true,
      safeguard,
      timestamp: new Date().toISOString()
    };
  });
}

export function registerReferenceProductTaxonomyRouteHandlers({
  fastify,
  readWorkingState,
  mutateWorkingState,
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
}) {
  registerCategoriesRoute({ fastify, readWorkingState });
  registerTagsListRoute({ fastify, readWorkingState, buildTagsPayload });
  registerProductsListRoute({ fastify, readWorkingState, buildProductsPipeline });
  registerProductTagsUpdateRoute({
    fastify,
    mutateWorkingState,
    evaluateSafeguard,
    normalizeTagIds,
    findTagByLabel,
    createTag,
    uniqueIds,
    haveSameIds,
    markDeployRequired,
    resolveProductRow
  });
  registerTagsImpactRoute({
    fastify,
    readWorkingState,
    normalizeTagIds,
    buildTagDeleteImpact,
    buildTagDeleteSafeguard,
    badRequest
  });
  registerTagDeleteRoute({
    fastify,
    mutateWorkingState,
    normalizeTagIds,
    buildTagDeleteImpact,
    buildTagDeleteSafeguard,
    buildTagsPayload,
    markDeployRequired
  });
  registerSafeguardPreviewRoute({ fastify, evaluateSafeguard });
}
