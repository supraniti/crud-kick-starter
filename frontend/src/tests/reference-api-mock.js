import { buildCollectionsApi } from "./reference-api-mock/collections-domain.js";
import { buildMetadataApi } from "./reference-api-mock/metadata-domain.js";
import { buildMissionOperatorApi } from "./reference-api-mock/mission-operator-domain.js";
import { buildProductsTaxonomiesApi } from "./reference-api-mock/products-taxonomies-domain.js";
import { buildRemotesDeployApi } from "./reference-api-mock/remotes-deploy-domain.js";
import { cloneState } from "./reference-api-mock/state.js";

export function createApiMock(options = {}) {
  const state = cloneState();
  if (typeof options.mutateState === "function") {
    options.mutateState(state);
  }

  return {
    ...buildMetadataApi(state),
    ...buildCollectionsApi(state),
    ...buildProductsTaxonomiesApi(state),
    ...buildRemotesDeployApi(state),
    ...buildMissionOperatorApi(state)
  };
}
