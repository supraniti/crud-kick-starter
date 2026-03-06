import { vi } from "vitest";
import {
  listRemoteDeployPayloadFields,
  validateRemoteDeployPayload
} from "../../../../server/src/domains/reference/contracts/remote-config/local-contract/remote-deploy-mission-contract.mjs";

function cloneJob(job) {
  return {
    ...job,
    payload: job.payload ? { ...job.payload } : {},
    result: job.result ? JSON.parse(JSON.stringify(job.result)) : null,
    error: job.error ? { ...job.error } : null,
    logs: (job.logs ?? []).map((entry) => ({ ...entry }))
  };
}

function resolveRemoteDeployMission(state) {
  const remotesModule = state.moduleRuntime.find((item) => item.id === "remotes") ?? null;
  const moduleState = remotesModule?.state ?? "discovered";

  return {
    missionId: "remote-deploy-mission",
    moduleId: "remotes",
    label: "Remote Deploy Mission",
    description: "Executes deployment missions against configured remotes.",
    payload: {
      fields: listRemoteDeployPayloadFields()
    },
    state: moduleState,
    active: moduleState === "enabled"
  };
}

function createListMissionsHandler(state) {
  return async () => ({
    ok: true,
    items: [resolveRemoteDeployMission(state)]
  });
}

function createMissionNotFoundResult(missionId) {
  return {
    ok: false,
    error: {
      code: "MISSION_NOT_FOUND",
      message: `Mission '${missionId}' was not found`
    }
  };
}

function createMissionInactiveResult(missionId, mission) {
  return {
    ok: false,
    error: {
      code: "MISSION_MODULE_NOT_ENABLED",
      message: `Mission '${missionId}' cannot run because module '${mission.moduleId}' is '${mission.state}'`
    },
    mission
  };
}

function createMissionPayloadInvalidResult(missionId, mission, validation) {
  return {
    ok: false,
    error: {
      code: "MISSION_PAYLOAD_INVALID",
      message: `Mission '${missionId}' payload is invalid`
    },
    validation: validation.error,
    mission
  };
}

function buildMissionJob(state, missionId, mission, normalizedPayload) {
  const now = new Date().toISOString();
  const jobId = `mjob-${String(state.nextMissionJobNumber++).padStart(6, "0")}`;
  const shouldFail = normalizedPayload.shouldFail === true;

  return {
    id: jobId,
    type: `mission:${missionId}`,
    status: shouldFail ? "failed" : "succeeded",
    payload: normalizedPayload,
    result: shouldFail
      ? null
      : {
          missionId,
          moduleId: mission.moduleId,
          output: {
            ok: true,
            remoteId: normalizedPayload.remoteId,
            simulated: true
          }
        },
    error: shouldFail
      ? {
          code: "REMOTE_DEPLOY_MISSION_FAILED",
          message: "Remote deploy mission failed"
        }
      : null,
    logs: [
      {
        timestamp: now,
        level: "info",
        message: "Mission job queued"
      },
      {
        timestamp: now,
        level: "info",
        message: "Mission job started"
      },
      ...(shouldFail
        ? [
            {
              timestamp: now,
              level: "error",
              message: "Mission job failed"
            }
          ]
        : [
            {
              timestamp: now,
              level: "info",
              message: "Mission job succeeded"
            }
          ]),
    ],
    createdAt: now,
    updatedAt: now
  };
}

function createStartMissionJobHandler(state) {
  return async ({ missionId, payload = {} }) => {
    const mission = resolveRemoteDeployMission(state);
    if (missionId !== mission.missionId) {
      return createMissionNotFoundResult(missionId);
    }
    if (!mission.active) {
      return createMissionInactiveResult(missionId, mission);
    }

    const validation = validateRemoteDeployPayload(payload);
    if (!validation.ok) {
      return createMissionPayloadInvalidResult(missionId, mission, validation);
    }

    const job = buildMissionJob(state, missionId, mission, validation.payload);
    state.missionJobs.unshift(job);
    return {
      ok: true,
      mission,
      job: cloneJob(job)
    };
  };
}

function createListMissionJobsHandler(state) {
  return async () => ({
    ok: true,
    items: [...state.missionJobs]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(cloneJob)
  });
}

function createReadMissionJobHandler(state) {
  return async ({ jobId }) => {
    const job = state.missionJobs.find((entry) => entry.id === jobId) ?? null;
    if (!job) {
      return {
        ok: false,
        error: {
          code: "MISSION_JOB_NOT_FOUND",
          message: `Mission job '${jobId}' was not found`
        }
      };
    }
    return {
      ok: true,
      job: cloneJob(job)
    };
  };
}

function createCancelMissionJobHandler(state) {
  return async ({ jobId }) => {
    const job = state.missionJobs.find((entry) => entry.id === jobId) ?? null;
    if (!job) {
      return {
        ok: false,
        error: {
          code: "MISSION_JOB_NOT_FOUND",
          message: `Mission job '${jobId}' was not found`
        }
      };
    }

    if (job.status !== "queued" && job.status !== "running") {
      return {
        ok: false,
        error: {
          code: "MISSION_JOB_NOT_CANCELLABLE",
          message: `Mission job '${jobId}' cannot be cancelled from status '${job.status}'`
        },
        job: cloneJob(job)
      };
    }

    const now = new Date().toISOString();
    job.status = "cancelled";
    job.updatedAt = now;
    job.logs.push({
      timestamp: now,
      level: "info",
      message: "Mission job cancelled"
    });

    return {
      ok: true,
      job: cloneJob(job)
    };
  };
}

export function buildMissionOperatorApi(state) {
  return {
    listMissions: vi.fn().mockImplementation(createListMissionsHandler(state)),
    startMissionJob: vi.fn().mockImplementation(createStartMissionJobHandler(state)),
    listMissionJobs: vi.fn().mockImplementation(createListMissionJobsHandler(state)),
    readMissionJob: vi.fn().mockImplementation(createReadMissionJobHandler(state)),
    cancelMissionJob: vi.fn().mockImplementation(createCancelMissionJobHandler(state))
  };
}
