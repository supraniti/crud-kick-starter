import {
  buildMissionJobNotFoundPayload,
  buildMissionNotFoundPayload,
  buildMissionSummary,
  createMissionJobHandler,
  findMissionEntry,
  isMissionJobType,
  validateMissionPayload
} from "./mission-runtime-domain-service.js";

function registerMissionListRoute({
  fastify,
  missionRegistry,
  moduleRegistry
}) {
  fastify.get("/api/reference/missions", async () => {
    const items = missionRegistry
      .list()
      .map((entry) => buildMissionSummary(entry, moduleRegistry))
      .sort((left, right) => left.label.localeCompare(right.label));

    return {
      ok: true,
      items,
      timestamp: new Date().toISOString()
    };
  });
}

function registerMissionCreateJobRoute({
  fastify,
  missionRegistry,
  moduleRegistry,
  serviceRegistry,
  jobRunner,
  jobLogStore,
  toPublicJob,
  pushJobLog
}) {
  fastify.post("/api/reference/missions/:missionId/jobs", async (request, reply) => {
    const missionId = request.params?.missionId;
    const missionEntry = findMissionEntry(missionRegistry, missionId);
    if (!missionEntry) {
      reply.code(404);
      return buildMissionNotFoundPayload(missionId);
    }

    const moduleState = moduleRegistry.getState(missionEntry.moduleId);
    if (moduleState !== "enabled") {
      reply.code(409);
      return {
        ok: false,
        error: {
          code: "MISSION_MODULE_NOT_ENABLED",
          message: `Mission '${missionId}' cannot run because module '${missionEntry.moduleId}' is '${moduleState}'`
        },
        mission: buildMissionSummary(missionEntry, moduleRegistry),
        timestamp: new Date().toISOString()
      };
    }

    const execute = missionEntry.mission?.execute;
    if (typeof execute !== "function") {
      reply.code(500);
      return {
        ok: false,
        error: {
          code: "MISSION_EXECUTE_HANDLER_INVALID",
          message: `Mission '${missionId}' does not provide an executable handler`
        },
        mission: buildMissionSummary(missionEntry, moduleRegistry),
        timestamp: new Date().toISOString()
      };
    }

    const payload =
      request.body && typeof request.body === "object" && !Array.isArray(request.body)
        ? { ...request.body }
        : {};
    const payloadValidation = validateMissionPayload({
      missionId,
      missionEntry,
      payload
    });
    if (!payloadValidation.ok) {
      reply.code(payloadValidation.statusCode);
      return {
        ok: false,
        error: payloadValidation.error,
        validation: payloadValidation.validation,
        mission: buildMissionSummary(missionEntry, moduleRegistry),
        timestamp: new Date().toISOString()
      };
    }

    const submitted = jobRunner.submit({
      type: `mission:${missionId}`,
      payload: payloadValidation.payload,
      handler: createMissionJobHandler({
        missionId,
        missionEntry,
        moduleRegistry,
        serviceRegistry,
        pushJobLog,
        jobLogStore
      })
    });
    await pushJobLog(jobLogStore, submitted.job.id, "info", "Mission job queued", {
      missionId,
      moduleId: missionEntry.moduleId
    });

    reply.code(202);
    return {
      ok: true,
      mission: buildMissionSummary(missionEntry, moduleRegistry),
      job: toPublicJob(submitted.job, jobLogStore),
      timestamp: new Date().toISOString()
    };
  });
}

function registerMissionJobsListRoute({
  fastify,
  jobRunner,
  jobLogStore,
  toPublicJob
}) {
  fastify.get("/api/reference/missions/jobs", async () => {
    const items = jobRunner
      .list()
      .filter((job) => isMissionJobType(job.type))
      .map((job) => toPublicJob(job, jobLogStore))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return {
      ok: true,
      items,
      timestamp: new Date().toISOString()
    };
  });
}

function registerMissionJobReadRoute({
  fastify,
  jobRunner,
  jobLogStore,
  toPublicJob
}) {
  fastify.get("/api/reference/missions/jobs/:id", async (request, reply) => {
    const jobId = request.params?.id;
    const job = jobRunner.get(jobId);
    if (!job || !isMissionJobType(job.type)) {
      reply.code(404);
      return buildMissionJobNotFoundPayload(jobId);
    }

    return {
      ok: true,
      job: toPublicJob(job, jobLogStore),
      timestamp: new Date().toISOString()
    };
  });
}

function registerMissionJobCancelRoute({
  fastify,
  jobRunner,
  jobLogStore,
  toPublicJob,
  pushJobLog
}) {
  fastify.post("/api/reference/missions/jobs/:id/cancel", async (request, reply) => {
    const jobId = request.params?.id;
    const existing = jobRunner.get(jobId);
    if (!existing || !isMissionJobType(existing.type)) {
      reply.code(404);
      return buildMissionJobNotFoundPayload(jobId);
    }

    const cancellation = jobRunner.cancel(jobId);
    if (!cancellation.ok) {
      reply.code(409);
      return {
        ok: false,
        error: {
          code: "MISSION_JOB_NOT_CANCELLABLE",
          message: `Mission job '${jobId}' cannot be cancelled from status '${cancellation.status}'`
        },
        job: toPublicJob(existing, jobLogStore),
        timestamp: new Date().toISOString()
      };
    }

    await pushJobLog(jobLogStore, jobId, "info", "Mission job cancelled", {});
    return {
      ok: true,
      job: toPublicJob(jobRunner.get(jobId), jobLogStore),
      timestamp: new Date().toISOString()
    };
  });
}

export function registerReferenceMissionRouteHandlers({
  fastify,
  moduleRegistry,
  missionRegistry,
  serviceRegistry,
  jobRunner,
  jobLogStore,
  toPublicJob,
  pushJobLog
}) {
  registerMissionListRoute({
    fastify,
    missionRegistry,
    moduleRegistry
  });
  registerMissionCreateJobRoute({
    fastify,
    missionRegistry,
    moduleRegistry,
    serviceRegistry,
    jobRunner,
    jobLogStore,
    toPublicJob,
    pushJobLog
  });
  registerMissionJobsListRoute({
    fastify,
    jobRunner,
    jobLogStore,
    toPublicJob
  });
  registerMissionJobReadRoute({
    fastify,
    jobRunner,
    jobLogStore,
    toPublicJob
  });
  registerMissionJobCancelRoute({
    fastify,
    jobRunner,
    jobLogStore,
    toPublicJob,
    pushJobLog
  });
}
