import { vi } from "vitest";
import { validateRemoteConfigInput } from "../../../../server/src/domains/reference/contracts/remote-config/local-contract/remote-config-contract.mjs";
import {
  findRemote,
  hasRemoteLabelConflict,
  markDeployRequired,
  toDeployState,
  toId
} from "./state.js";

function createListRemotesHandler(state) {
  return async () => ({
    ok: true,
    items: state.remotes.map((item) => ({ ...item }))
  });
}

function createCreateRemoteHandler(state) {
  return async ({ label, kind, endpoint, enabled }) => {
    const validation = validateRemoteConfigInput({
      label,
      kind,
      endpoint,
      enabled
    });
    if (!validation.ok) {
      return {
        ok: false,
        error: validation.errors[0]
      };
    }

    if (hasRemoteLabelConflict(state, validation.value.label)) {
      return {
        ok: false,
        error: {
          code: "REMOTE_LABEL_CONFLICT",
          message: `Remote label '${validation.value.label}' already exists`
        }
      };
    }

    const item = {
      id: toId("remote", state.nextRemoteNumber++),
      ...validation.value
    };
    state.remotes.push(item);
    markDeployRequired(state);

    return {
      ok: true,
      item: { ...item }
    };
  };
}

function createUpdateRemoteHandler(state) {
  return async ({ remoteId, ...changes }) => {
    const existing = findRemote(state, remoteId);
    if (!existing) {
      return {
        ok: false,
        error: {
          code: "REMOTE_NOT_FOUND",
          message: `Remote '${remoteId}' was not found`
        }
      };
    }

    const validation = validateRemoteConfigInput(changes, {
      partial: true
    });
    if (!validation.ok) {
      return {
        ok: false,
        error: validation.errors[0]
      };
    }

    const normalizedChanges = validation.value;
    const candidateLabel =
      changes.label === undefined ? existing.label : normalizedChanges.label;
    if (hasRemoteLabelConflict(state, candidateLabel, existing.id)) {
      return {
        ok: false,
        error: {
          code: "REMOTE_LABEL_CONFLICT",
          message: `Remote label '${candidateLabel}' already exists`
        }
      };
    }

    if (changes.label !== undefined) {
      existing.label = normalizedChanges.label;
    }
    if (changes.kind !== undefined) {
      existing.kind = normalizedChanges.kind;
    }
    if (changes.endpoint !== undefined) {
      existing.endpoint = normalizedChanges.endpoint;
    }
    if (changes.enabled !== undefined) {
      existing.enabled = normalizedChanges.enabled;
    }
    markDeployRequired(state);

    return {
      ok: true,
      item: { ...existing }
    };
  };
}

function createDeleteRemoteHandler(state) {
  return async ({ remoteId }) => {
    const index = state.remotes.findIndex((item) => item.id === remoteId);
    if (index < 0) {
      return {
        ok: false,
        error: {
          code: "REMOTE_NOT_FOUND",
          message: `Remote '${remoteId}' was not found`
        }
      };
    }

    state.remotes.splice(index, 1);
    if (state.release.lastDeployRemoteId === remoteId) {
      state.release.lastDeployRemoteId = null;
    }
    markDeployRequired(state);

    return {
      ok: true,
      removed: {
        remoteId
      }
    };
  };
}

function createReadDeployStateHandler(state) {
  return async () => ({
    ok: true,
    deploy: toDeployState(state)
  });
}

function createListDeployJobsHandler(state) {
  return async () => ({
    ok: true,
    items: [...state.jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  });
}

function createStartDeployJobHandler(state) {
  return async ({ remoteId }) => {
    if (!state.release.deployRequired) {
      return {
        ok: false,
        error: {
          code: "DEPLOY_NOT_REQUIRED",
          message: "No deploy is required for the current revision"
        }
      };
    }

    const remote = findRemote(state, remoteId);
    if (!remote) {
      return {
        ok: false,
        error: {
          code: "REMOTE_NOT_FOUND",
          message: `Remote '${remoteId}' was not found`
        }
      };
    }

    if (!remote.enabled) {
      return {
        ok: false,
        error: {
          code: "REMOTE_DISABLED",
          message: `Remote '${remoteId}' is disabled`
        }
      };
    }

    const now = new Date().toISOString();
    const jobId = `job-${String(state.nextJobNumber++).padStart(6, "0")}`;
    const job = {
      id: jobId,
      type: "deploy-remote",
      status: "succeeded",
      payload: {
        remoteId
      },
      result: {
        remote: {
          id: remote.id,
          label: remote.label,
          kind: remote.kind
        }
      },
      logs: [
        {
          timestamp: now,
          level: "info",
          message: "Deploy job queued"
        },
        {
          timestamp: now,
          level: "info",
          message: "Deploy job started"
        },
        {
          timestamp: now,
          level: "info",
          message: "Deploy job succeeded"
        }
      ],
      createdAt: now,
      updatedAt: now
    };
    state.jobs.unshift(job);

    state.release.deployedRevision = state.release.currentRevision;
    state.release.deployRequired = false;
    state.release.lastDeployAt = now;
    state.release.lastDeployJobId = jobId;
    state.release.lastDeployRemoteId = remote.id;

    return {
      ok: true,
      job
    };
  };
}

export function buildRemotesDeployApi(state) {
  return {
    listRemotes: vi.fn().mockImplementation(createListRemotesHandler(state)),
    createRemote: vi.fn().mockImplementation(createCreateRemoteHandler(state)),
    updateRemote: vi.fn().mockImplementation(createUpdateRemoteHandler(state)),
    deleteRemote: vi.fn().mockImplementation(createDeleteRemoteHandler(state)),
    readDeployState: vi.fn().mockImplementation(createReadDeployStateHandler(state)),
    listDeployJobs: vi.fn().mockImplementation(createListDeployJobsHandler(state)),
    startDeployJob: vi.fn().mockImplementation(createStartDeployJobHandler(state))
  };
}
