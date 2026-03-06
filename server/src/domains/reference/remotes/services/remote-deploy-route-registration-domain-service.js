import {
  createDeployJobCreateRouteHandler,
  createRemotesCreateRouteHandler,
  createRemotesDeleteRouteHandler,
  createRemotesUpdateRouteHandler
} from "./remote-deploy-route-handler-service.js";

function registerRemotesListRoute({ fastify, readWorkingState, buildRemotesPayload }) {
  fastify.get("/api/reference/remotes", async () => {
    const workingState = await readWorkingState();
    return {
      ok: true,
      items: buildRemotesPayload(workingState),
      timestamp: new Date().toISOString()
    };
  });
}

function registerRemotesCreateRoute({
  fastify,
  mutateWorkingState,
  validateRemoteInput,
  badRequest,
  hasRemoteLabelConflict,
  nextRemoteId,
  markDeployRequired,
  toDeployStatePayload
}) {
  fastify.post(
    "/api/reference/remotes",
    createRemotesCreateRouteHandler({
      mutateWorkingState,
      validateRemoteInput,
      badRequest,
      hasRemoteLabelConflict,
      nextRemoteId,
      markDeployRequired,
      toDeployStatePayload
    })
  );
}

function registerRemotesUpdateRoute({
  fastify,
  readWorkingState,
  mutateWorkingState,
  validateRemoteInput,
  badRequest,
  hasRemoteLabelConflict,
  markDeployRequired,
  toDeployStatePayload,
  findRemoteById
}) {
  fastify.put(
    "/api/reference/remotes/:id",
    createRemotesUpdateRouteHandler({
      readWorkingState,
      mutateWorkingState,
      validateRemoteInput,
      badRequest,
      hasRemoteLabelConflict,
      markDeployRequired,
      toDeployStatePayload,
      findRemoteById
    })
  );
}

function registerRemotesDeleteRoute({
  fastify,
  mutateWorkingState,
  markDeployRequired,
  toDeployStatePayload
}) {
  fastify.delete(
    "/api/reference/remotes/:id",
    createRemotesDeleteRouteHandler({
      mutateWorkingState,
      markDeployRequired,
      toDeployStatePayload
    })
  );
}

function registerDeployStateRoute({ fastify, readWorkingState, toDeployStatePayload }) {
  fastify.get("/api/reference/deploy/state", async () => {
    const workingState = await readWorkingState();
    return {
      ok: true,
      deploy: toDeployStatePayload(workingState),
      timestamp: new Date().toISOString()
    };
  });
}

function registerDeployJobsListRoute({ fastify, jobRunner, toPublicJob, jobLogStore }) {
  fastify.get("/api/reference/deploy/jobs", async () => {
    const items = jobRunner
      .list()
      .map((job) => toPublicJob(job, jobLogStore))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      ok: true,
      items,
      timestamp: new Date().toISOString()
    };
  });
}

function registerDeployJobReadRoute({ fastify, jobRunner, toPublicJob, jobLogStore }) {
  fastify.get("/api/reference/deploy/jobs/:id", async (request, reply) => {
    const job = jobRunner.get(request.params?.id);
    if (!job) {
      reply.code(404);
      return {
        ok: false,
        error: {
          code: "JOB_NOT_FOUND",
          message: `Deploy job '${request.params?.id}' was not found`
        },
        timestamp: new Date().toISOString()
      };
    }

    return {
      ok: true,
      job: toPublicJob(job, jobLogStore),
      timestamp: new Date().toISOString()
    };
  });
}

function registerDeployJobCreateRoute({
  fastify,
  state,
  readWorkingState,
  mutateWorkingState,
  jobRunner,
  jobLogStore,
  badRequest,
  toDeployStatePayload,
  findRemoteById,
  toPublicJob,
  cloneReferenceData,
  generateDeployArtifacts,
  executeRemoteDeploy,
  pushJobLog
}) {
  fastify.post(
    "/api/reference/deploy/jobs",
    createDeployJobCreateRouteHandler({
      state,
      readWorkingState,
      mutateWorkingState,
      jobRunner,
      jobLogStore,
      badRequest,
      toDeployStatePayload,
      findRemoteById,
      toPublicJob,
      cloneReferenceData,
      generateDeployArtifacts,
      executeRemoteDeploy,
      pushJobLog
    })
  );
}

export function registerReferenceRemoteDeployRouteHandlers({
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
}) {
  registerRemotesListRoute({ fastify, readWorkingState, buildRemotesPayload });
  registerRemotesCreateRoute({
    fastify,
    mutateWorkingState,
    validateRemoteInput,
    badRequest,
    hasRemoteLabelConflict,
    nextRemoteId,
    markDeployRequired,
    toDeployStatePayload
  });
  registerRemotesUpdateRoute({
    fastify,
    readWorkingState,
    mutateWorkingState,
    validateRemoteInput,
    badRequest,
    hasRemoteLabelConflict,
    markDeployRequired,
    toDeployStatePayload,
    findRemoteById
  });
  registerRemotesDeleteRoute({
    fastify,
    mutateWorkingState,
    markDeployRequired,
    toDeployStatePayload
  });
  registerDeployStateRoute({ fastify, readWorkingState, toDeployStatePayload });
  registerDeployJobsListRoute({ fastify, jobRunner, toPublicJob, jobLogStore });
  registerDeployJobReadRoute({ fastify, jobRunner, toPublicJob, jobLogStore });
  registerDeployJobCreateRoute({
    fastify,
    state,
    readWorkingState,
    mutateWorkingState,
    jobRunner,
    jobLogStore,
    badRequest,
    toDeployStatePayload,
    findRemoteById,
    toPublicJob,
    cloneReferenceData,
    generateDeployArtifacts,
    executeRemoteDeploy,
    pushJobLog
  });
}
