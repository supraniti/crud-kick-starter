import {
  createDeployJobHandler,
  createRemoteCreateMutation,
  createRemoteDeleteMutation,
  createRemoteUpdateMutation,
  resolveDeployJobSubmissionContext,
  toPersistenceFailedPayload
} from "./remote-deploy-domain-service.js";

function buildRemoteNotFoundPayload(remoteId) {
  return {
    ok: false,
    error: {
      code: "REMOTE_NOT_FOUND",
      message: `Remote '${remoteId}' was not found`
    },
    timestamp: new Date().toISOString()
  };
}

function buildPatchPresence(body) {
  return {
    label: body?.label !== undefined,
    kind: body?.kind !== undefined,
    endpoint: body?.endpoint !== undefined,
    enabled: body?.enabled !== undefined
  };
}

export function createRemotesCreateRouteHandler({
  mutateWorkingState,
  validateRemoteInput,
  badRequest,
  hasRemoteLabelConflict,
  nextRemoteId,
  markDeployRequired,
  toDeployStatePayload
}) {
  return async (request, reply) => {
    const validation = validateRemoteInput(request.body ?? {});
    if (!validation.ok) {
      return badRequest(reply, validation.errors[0].code, validation.errors[0].message);
    }

    let createResult;
    try {
      createResult = await mutateWorkingState((workingState) =>
        createRemoteCreateMutation({
          workingState,
          remoteInput: validation.value,
          hasRemoteLabelConflict,
          nextRemoteId,
          markDeployRequired,
          toDeployStatePayload
        })
      );
    } catch (error) {
      reply.code(500);
      return toPersistenceFailedPayload("remote-create", error);
    }

    if (!createResult.ok) {
      if (typeof createResult.statusCode === "number") {
        reply.code(createResult.statusCode);
      }
      return createResult.payload;
    }

    reply.code(201);
    return {
      ok: true,
      item: createResult.item,
      deploy: createResult.deploy,
      timestamp: new Date().toISOString()
    };
  };
}

export function createRemotesUpdateRouteHandler({
  readWorkingState,
  mutateWorkingState,
  validateRemoteInput,
  badRequest,
  hasRemoteLabelConflict,
  markDeployRequired,
  toDeployStatePayload,
  findRemoteById
}) {
  return async (request, reply) => {
    const remoteId = request.params?.id;
    let currentState;
    try {
      currentState = await readWorkingState();
    } catch (error) {
      reply.code(500);
      return toPersistenceFailedPayload("remote-read", error);
    }

    const existing = findRemoteById(currentState, remoteId);
    if (!existing) {
      reply.code(404);
      return buildRemoteNotFoundPayload(remoteId);
    }

    const validation = validateRemoteInput(request.body ?? {}, {
      partial: true
    });
    if (!validation.ok) {
      return badRequest(reply, validation.errors[0].code, validation.errors[0].message);
    }

    const changes = validation.value;
    const nextLabel = request.body?.label === undefined ? existing.label : changes.label;
    const patchPresence = buildPatchPresence(request.body);

    let updateResult;
    try {
      updateResult = await mutateWorkingState((workingState) =>
        createRemoteUpdateMutation({
          workingState,
          remoteId,
          changes,
          patchPresence,
          nextLabel,
          hasRemoteLabelConflict,
          markDeployRequired,
          toDeployStatePayload,
          findRemoteById
        })
      );
    } catch (error) {
      reply.code(500);
      return toPersistenceFailedPayload("remote-update", error);
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
      deploy: updateResult.deploy,
      timestamp: new Date().toISOString()
    };
  };
}

export function createRemotesDeleteRouteHandler({
  mutateWorkingState,
  markDeployRequired,
  toDeployStatePayload
}) {
  return async (request, reply) => {
    const remoteId = request.params?.id;
    let deleteResult;
    try {
      deleteResult = await mutateWorkingState((workingState) =>
        createRemoteDeleteMutation({
          workingState,
          remoteId,
          markDeployRequired,
          toDeployStatePayload
        })
      );
    } catch (error) {
      reply.code(500);
      return toPersistenceFailedPayload("remote-delete", error);
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
      deploy: deleteResult.deploy,
      timestamp: new Date().toISOString()
    };
  };
}

export function createDeployJobCreateRouteHandler({
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
  return async (request, reply) => {
    let workingState;
    try {
      workingState = await readWorkingState();
    } catch (error) {
      reply.code(500);
      return toPersistenceFailedPayload("deploy-state-read", error);
    }

    const remoteId = typeof request.body?.remoteId === "string" ? request.body.remoteId.trim() : "";
    if (remoteId.length === 0) {
      return badRequest(reply, "REMOTE_ID_REQUIRED", "Deploy request requires remoteId");
    }

    const submission = resolveDeployJobSubmissionContext({
      workingState,
      remoteId,
      findRemoteById,
      toDeployStatePayload
    });
    if (!submission.ok) {
      reply.code(submission.statusCode);
      return submission.payload;
    }

    const snapshot = cloneReferenceData(state);
    const handler = createDeployJobHandler({
      mutateWorkingState,
      jobLogStore,
      generateDeployArtifacts,
      executeRemoteDeploy,
      pushJobLog,
      snapshot,
      state
    });

    const submitted = jobRunner.submit({
      type: "deploy-remote",
      payload: {
        remote: { ...submission.remote },
        revision: submission.revision
      },
      handler
    });

    const jobId = submitted.job.id;
    await pushJobLog(jobLogStore, jobId, "info", "Deploy job queued", {
      revision: submission.revision,
      remoteId: submission.remote.id
    });

    reply.code(202);
    return {
      ok: true,
      job: toPublicJob(submitted.job, jobLogStore),
      deploy: toDeployStatePayload(workingState),
      timestamp: new Date().toISOString()
    };
  };
}
