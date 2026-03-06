import {
  createProductTaxonomyWorkingStateAccessors,
  resolveProductTaxonomyStateRepository
} from "../../domains/reference/product-taxonomies/services/product-taxonomy-domain-service.js";
import {
  registerReferenceProductTaxonomyRouteHandlers
} from "../../domains/reference/product-taxonomies/services/product-taxonomy-route-registration-domain-service.js";

export function registerReferenceProductTaxonomyRoutes({
  fastify,
  state,
  productsTaxonomiesRepository,
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
  const repository = resolveProductTaxonomyStateRepository(productsTaxonomiesRepository);
  const { readWorkingState, mutateWorkingState } = createProductTaxonomyWorkingStateAccessors(
    repository,
    state
  );

  registerReferenceProductTaxonomyRouteHandlers({
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
  });
}
