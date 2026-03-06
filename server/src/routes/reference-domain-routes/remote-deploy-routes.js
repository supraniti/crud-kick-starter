import {
  createRemotesWorkingStateAccessors,
  resolveRemotesDeployStateRepository
} from "../../domains/reference/remotes/services/remote-deploy-domain-service.js";
import {
  registerReferenceRemoteDeployRouteHandlers
} from "../../domains/reference/remotes/services/remote-deploy-route-registration-domain-service.js";

export function registerReferenceRemoteDeployRoutes({
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
  generateDeployArtifacts,
  executeRemoteDeploy,
  pushJobLog
}) {
  const repository = resolveRemotesDeployStateRepository(remotesDeployRepository);
  const { readWorkingState, mutateWorkingState } = createRemotesWorkingStateAccessors(
    repository,
    state
  );

  registerReferenceRemoteDeployRouteHandlers({
    fastify,
    state,
    readWorkingState,
    mutateWorkingState,
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
    generateDeployArtifacts,
    executeRemoteDeploy,
    pushJobLog
  });
}
