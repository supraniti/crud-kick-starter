function toTimestampedPayload(payload) {
  return {
    ...payload,
    timestamp: new Date().toISOString()
  };
}

function toRemoteNotFoundPayload(remoteId) {
  return toTimestampedPayload({
    ok: false,
    error: {
      code: "REMOTE_NOT_FOUND",
      message: `Remote '${remoteId}' was not found`
    }
  });
}

function toRemoteLabelConflictPayload(label) {
  return toTimestampedPayload({
    ok: false,
    error: {
      code: "REMOTE_LABEL_CONFLICT",
      message: `Remote label '${label}' already exists`
    }
  });
}

function toRemoteDisabledPayload(remoteId) {
  return toTimestampedPayload({
    ok: false,
    error: {
      code: "REMOTE_DISABLED",
      message: `Remote '${remoteId}' is disabled`
    }
  });
}

function toDeployNotRequiredPayload(workingState, toDeployStatePayload) {
  return toTimestampedPayload({
    ok: false,
    error: {
      code: "DEPLOY_NOT_REQUIRED",
      message: "No deploy is required for the current revision"
    },
    deploy: toDeployStatePayload(workingState)
  });
}

export function resolveRemotesDeployStateRepository(remotesDeployRepository) {
  return remotesDeployRepository &&
    typeof remotesDeployRepository.readState === "function" &&
    typeof remotesDeployRepository.transact === "function"
    ? remotesDeployRepository
    : null;
}

export function createRemotesWorkingStateAccessors(repository, state) {
  const readWorkingState = async () => (repository ? repository.readState() : state);
  const mutateWorkingState = async (mutator) => {
    if (repository) {
      return repository.transact(mutator);
    }

    const outcome = await mutator(state);
    return Object.prototype.hasOwnProperty.call(outcome ?? {}, "value")
      ? outcome.value
      : outcome;
  };

  return { readWorkingState, mutateWorkingState };
}

export function toPersistenceFailedPayload(action, error) {
  return toTimestampedPayload({
    ok: false,
    error: {
      code: error?.code ?? "REFERENCE_STATE_PERSISTENCE_FAILED",
      message:
        error?.message ?? `Reference-state persistence failed while handling '${action}'`
    }
  });
}

export function createRemoteCreateMutation({
  workingState,
  remoteInput,
  hasRemoteLabelConflict,
  nextRemoteId,
  markDeployRequired,
  toDeployStatePayload
}) {
  if (hasRemoteLabelConflict(workingState, remoteInput.label)) {
    return {
      commit: false,
      value: {
        ok: false,
        statusCode: 409,
        payload: toRemoteLabelConflictPayload(remoteInput.label)
      }
    };
  }

  const item = {
    id: nextRemoteId(workingState),
    ...remoteInput
  };
  workingState.remotes.push(item);
  markDeployRequired(workingState);

  return {
    commit: true,
    value: {
      ok: true,
      item,
      deploy: toDeployStatePayload(workingState)
    }
  };
}

export function createRemoteUpdateMutation({
  workingState,
  remoteId,
  changes,
  patchPresence,
  nextLabel,
  hasRemoteLabelConflict,
  markDeployRequired,
  toDeployStatePayload,
  findRemoteById
}) {
  const target = findRemoteById(workingState, remoteId);
  if (!target) {
    return {
      commit: false,
      value: {
        ok: false,
        statusCode: 404,
        payload: toRemoteNotFoundPayload(remoteId)
      }
    };
  }

  if (hasRemoteLabelConflict(workingState, nextLabel, target.id)) {
    return {
      commit: false,
      value: {
        ok: false,
        statusCode: 409,
        payload: toRemoteLabelConflictPayload(nextLabel)
      }
    };
  }

  if (patchPresence.label) {
    target.label = changes.label;
  }
  if (patchPresence.kind) {
    target.kind = changes.kind;
  }
  if (patchPresence.endpoint) {
    target.endpoint = changes.endpoint;
  }
  if (patchPresence.enabled) {
    target.enabled = changes.enabled;
  }

  markDeployRequired(workingState);

  return {
    commit: true,
    value: {
      ok: true,
      item: { ...target },
      deploy: toDeployStatePayload(workingState)
    }
  };
}

export function createRemoteDeleteMutation({
  workingState,
  remoteId,
  markDeployRequired,
  toDeployStatePayload
}) {
  const index = workingState.remotes.findIndex((remote) => remote.id === remoteId);
  if (index < 0) {
    return {
      commit: false,
      value: {
        ok: false,
        statusCode: 404,
        payload: toRemoteNotFoundPayload(remoteId)
      }
    };
  }

  workingState.remotes.splice(index, 1);
  markDeployRequired(workingState);
  if (workingState.release.lastDeployRemoteId === remoteId) {
    workingState.release.lastDeployRemoteId = null;
  }

  return {
    commit: true,
    value: {
      ok: true,
      removed: {
        remoteId
      },
      deploy: toDeployStatePayload(workingState)
    }
  };
}

export function resolveDeployJobSubmissionContext({
  workingState,
  remoteId,
  findRemoteById,
  toDeployStatePayload
}) {
  if (!workingState.release.deployRequired) {
    return {
      ok: false,
      statusCode: 409,
      payload: toDeployNotRequiredPayload(workingState, toDeployStatePayload)
    };
  }

  const remote = findRemoteById(workingState, remoteId);
  if (!remote) {
    return {
      ok: false,
      statusCode: 404,
      payload: toRemoteNotFoundPayload(remoteId)
    };
  }

  if (!remote.enabled) {
    return {
      ok: false,
      statusCode: 409,
      payload: toRemoteDisabledPayload(remoteId)
    };
  }

  return {
    ok: true,
    remote,
    revision: workingState.release.currentRevision
  };
}

export function createDeployJobHandler({
  mutateWorkingState,
  jobLogStore,
  generateDeployArtifacts,
  executeRemoteDeploy,
  pushJobLog,
  snapshot,
  state
}) {
  return async (payload, context) => {
    try {
      await pushJobLog(jobLogStore, context.jobId, "info", "Deploy job started", {
        revision: payload.revision,
        remoteId: payload.remote.id
      });

      const artifacts = await generateDeployArtifacts(snapshot, payload.revision);
      await pushJobLog(jobLogStore, context.jobId, "info", "Static artifacts generated", {
        outputDir: artifacts.outputDir,
        fileCount: artifacts.counts.files
      });

      const deployment = await executeRemoteDeploy(payload.remote, artifacts);
      await pushJobLog(
        jobLogStore,
        context.jobId,
        "info",
        "Remote deploy execution completed",
        {
          remoteId: payload.remote.id,
          mode: deployment.mode,
          destination: deployment.destination
        }
      );

      await mutateWorkingState(async (releaseState) => {
        releaseState.release.deployedRevision = Math.max(
          releaseState.release.deployedRevision,
          payload.revision
        );
        releaseState.release.deployRequired =
          releaseState.release.currentRevision > releaseState.release.deployedRevision;
        releaseState.release.lastDeployAt = new Date().toISOString();
        releaseState.release.lastDeployJobId = context.jobId;
        releaseState.release.lastDeployRemoteId = payload.remote.id;

        return {
          commit: true,
          value: null
        };
      });

      await pushJobLog(jobLogStore, context.jobId, "info", "Deploy job succeeded", {
        deployedRevision: state.release.deployedRevision,
        deployRequired: state.release.deployRequired
      });

      return {
        remote: payload.remote,
        revision: payload.revision,
        artifacts,
        deployment
      };
    } catch (error) {
      await pushJobLog(jobLogStore, context.jobId, "error", "Deploy job failed", {
        code: error?.code ?? "DEPLOY_JOB_FAILED",
        message: error?.message ?? "Deploy job failed"
      });
      throw error;
    }
  };
}
