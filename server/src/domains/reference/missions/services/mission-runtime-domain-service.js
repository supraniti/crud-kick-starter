export function isMissionJobType(type) {
  return typeof type === "string" && type.startsWith("mission:");
}

function clonePayloadField(field) {
  if (!field || typeof field !== "object") {
    return null;
  }

  const normalized = {
    id: field.id,
    label: field.label,
    type: field.type,
    required: field.required === true,
    description: typeof field.description === "string" ? field.description : "",
    placeholder: typeof field.placeholder === "string" ? field.placeholder : "",
    defaultValue: field.defaultValue ?? null
  };

  if (Array.isArray(field.options)) {
    normalized.options = field.options
      .filter((option) => option && typeof option === "object")
      .map((option) => ({
        value: option.value,
        label: option.label
      }));
  }

  return normalized;
}

function missionPayloadMetadata(entry) {
  const payload = entry.mission?.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const fields = Array.isArray(payload.fields)
    ? payload.fields.map((field) => clonePayloadField(field)).filter(Boolean)
    : [];

  return {
    fields
  };
}

export function buildMissionSummary(entry, moduleRegistry) {
  const moduleState = moduleRegistry.getState(entry.moduleId);
  const mission = entry.mission ?? {};

  return {
    missionId: entry.missionId,
    moduleId: entry.moduleId,
    label: typeof mission.label === "string" && mission.label.length > 0 ? mission.label : entry.missionId,
    description: typeof mission.description === "string" ? mission.description : "",
    state: moduleState,
    active: moduleState === "enabled",
    payload: missionPayloadMetadata(entry)
  };
}

export function findMissionEntry(missionRegistry, missionId) {
  return missionRegistry.list().find((entry) => entry.missionId === missionId) ?? null;
}

export function buildMissionNotFoundPayload(missionId) {
  return {
    ok: false,
    error: {
      code: "MISSION_NOT_FOUND",
      message: `Mission '${missionId}' was not found`
    },
    timestamp: new Date().toISOString()
  };
}

function normalizeValidationDetails(validation) {
  if (!validation || typeof validation !== "object") {
    return {
      code: "MISSION_PAYLOAD_INVALID",
      message: "Mission payload is invalid"
    };
  }

  const { code, message, ...details } = validation;
  return {
    code: typeof code === "string" && code.length > 0 ? code : "MISSION_PAYLOAD_INVALID",
    message: typeof message === "string" && message.length > 0 ? message : "Mission payload is invalid",
    ...details
  };
}

export function validateMissionPayload({ missionId, missionEntry, payload }) {
  const validator = missionEntry.mission?.validatePayload;
  if (typeof validator !== "function") {
    return {
      ok: true,
      payload
    };
  }

  let validationResult;
  try {
    validationResult = validator(payload);
  } catch (error) {
    return {
      ok: false,
      statusCode: 500,
      error: {
        code: "MISSION_PAYLOAD_VALIDATOR_FAILED",
        message: `Mission '${missionId}' payload validator failed`
      },
      validation: {
        code: error?.code ?? "MISSION_PAYLOAD_VALIDATOR_FAILED",
        message: error?.message ?? "Mission payload validator failed"
      }
    };
  }

  if (!validationResult || validationResult.ok !== true) {
    return {
      ok: false,
      statusCode: 400,
      error: {
        code: "MISSION_PAYLOAD_INVALID",
        message: `Mission '${missionId}' payload is invalid`
      },
      validation: normalizeValidationDetails(validationResult?.error)
    };
  }

  if (
    validationResult.payload !== undefined &&
    (!validationResult.payload ||
      typeof validationResult.payload !== "object" ||
      Array.isArray(validationResult.payload))
  ) {
    return {
      ok: false,
      statusCode: 500,
      error: {
        code: "MISSION_PAYLOAD_VALIDATOR_FAILED",
        message: `Mission '${missionId}' payload validator returned invalid normalized payload`
      },
      validation: {
        code: "MISSION_PAYLOAD_VALIDATOR_INVALID_RESULT",
        message: "Mission payload validator must return payload as an object when provided"
      }
    };
  }

  return {
    ok: true,
    payload:
      validationResult.payload !== undefined
        ? { ...validationResult.payload }
        : payload
  };
}

export function buildMissionJobNotFoundPayload(jobId) {
  return {
    ok: false,
    error: {
      code: "MISSION_JOB_NOT_FOUND",
      message: `Mission job '${jobId}' was not found`
    },
    timestamp: new Date().toISOString()
  };
}

export function createMissionJobHandler({
  missionId,
  missionEntry,
  moduleRegistry,
  serviceRegistry,
  pushJobLog,
  jobLogStore
}) {
  return async (jobPayload, context) => {
    const missionContext = {
      jobId: context.jobId,
      missionId,
      moduleId: missionEntry.moduleId,
      moduleRegistry,
      getService: (serviceId) => serviceRegistry.get(serviceId),
      async log(level, message, details = {}) {
        await pushJobLog(jobLogStore, context.jobId, level, message, details);
      }
    };

    try {
      await pushJobLog(jobLogStore, context.jobId, "info", "Mission job started", {
        missionId,
        moduleId: missionEntry.moduleId
      });
      const result = await missionEntry.mission.execute(jobPayload, missionContext);
      await pushJobLog(jobLogStore, context.jobId, "info", "Mission job succeeded", {
        missionId,
        moduleId: missionEntry.moduleId
      });
      return {
        missionId,
        moduleId: missionEntry.moduleId,
        output: result ?? null
      };
    } catch (error) {
      await pushJobLog(jobLogStore, context.jobId, "error", "Mission job failed", {
        missionId,
        moduleId: missionEntry.moduleId,
        code: error?.code ?? "MISSION_JOB_FAILED",
        message: error?.message ?? "Mission job failed"
      });
      throw error;
    }
  };
}
