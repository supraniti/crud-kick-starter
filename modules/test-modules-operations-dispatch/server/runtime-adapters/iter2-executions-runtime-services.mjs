export function registerServices({ registry }) {
  registry.register({
    serviceId: "iter2-executions-index-service",
    moduleId: "iter2-executions",
    service: {
      label: "Iter2 Executions Index Service",
      description: "Provides runtime metadata for iter2 execution indexing and search refresh."
    }
  });
}

const ITER2_EXECUTION_MISSION_PAYLOAD_FIELDS = Object.freeze([
  {
    id: "executionId",
    label: "Execution Id",
    type: "text",
    required: false,
    description: "Optional iter2 execution id to associate with the mission run.",
    placeholder: "iex-001",
    defaultValue: null
  },
  {
    id: "releasePlanId",
    label: "Release Plan Id",
    type: "text",
    required: false,
    description: "Optional release-plan id to include in execution context.",
    placeholder: "irp-001",
    defaultValue: null
  },
  {
    id: "remoteId",
    label: "Remote Id",
    type: "text",
    required: false,
    description: "Optional remote id to route mission execution.",
    placeholder: "remote-001",
    defaultValue: null
  },
  {
    id: "shouldFail",
    label: "Force Failure",
    type: "boolean",
    required: false,
    description: "Force deterministic mission failure for negative-path verification.",
    defaultValue: false
  }
]);

function normalizeOptionalStringField(rawValue, fieldId, message) {
  if (rawValue === undefined || rawValue === null) {
    return {
      ok: true,
      value: null
    };
  }

  if (typeof rawValue !== "string") {
    return {
      ok: false,
      error: {
        code: "ITER2_EXECUTION_MISSION_PAYLOAD_INVALID",
        message,
        fieldId
      }
    };
  }

  const normalized = rawValue.trim();
  if (normalized.length === 0) {
    return {
      ok: false,
      error: {
        code: "ITER2_EXECUTION_MISSION_PAYLOAD_INVALID",
        message,
        fieldId
      }
    };
  }

  return {
    ok: true,
    value: normalized
  };
}

function validateExecutionMissionPayload(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      ok: false,
      error: {
        code: "ITER2_EXECUTION_MISSION_PAYLOAD_INVALID",
        message: "Execution mission payload must be an object"
      }
    };
  }

  const normalizedExecutionId = normalizeOptionalStringField(
    payload.executionId,
    "executionId",
    "executionId must be a non-empty string when provided"
  );
  if (!normalizedExecutionId.ok) {
    return normalizedExecutionId;
  }

  const normalizedReleasePlanId = normalizeOptionalStringField(
    payload.releasePlanId,
    "releasePlanId",
    "releasePlanId must be a non-empty string when provided"
  );
  if (!normalizedReleasePlanId.ok) {
    return normalizedReleasePlanId;
  }

  const normalizedRemoteId = normalizeOptionalStringField(
    payload.remoteId,
    "remoteId",
    "remoteId must be a non-empty string when provided"
  );
  if (!normalizedRemoteId.ok) {
    return normalizedRemoteId;
  }

  if (
    payload.shouldFail !== undefined &&
    payload.shouldFail !== null &&
    typeof payload.shouldFail !== "boolean"
  ) {
    return {
      ok: false,
      error: {
        code: "ITER2_EXECUTION_MISSION_PAYLOAD_INVALID",
        message: "shouldFail must be a boolean when provided",
        fieldId: "shouldFail"
      }
    };
  }

  return {
    ok: true,
    payload: {
      executionId: normalizedExecutionId.value,
      releasePlanId: normalizedReleasePlanId.value,
      remoteId: normalizedRemoteId.value,
      shouldFail: payload.shouldFail === true
    }
  };
}

export function registerMissions({ registry }) {
  registry.register({
    missionId: "iter2-execution-mission",
    moduleId: "iter2-executions",
    mission: {
      label: "Iter2 Execution Mission",
      description: "Runs a deterministic execution simulation for iter2 release flows.",
      payload: {
        fields: ITER2_EXECUTION_MISSION_PAYLOAD_FIELDS.map((field) => ({
          ...field
        }))
      },
      validatePayload: validateExecutionMissionPayload,
      execute: async (payload = {}, context = {}) => {
        const executionId =
          typeof payload.executionId === "string" ? payload.executionId : null;
        const releasePlanId =
          typeof payload.releasePlanId === "string" ? payload.releasePlanId : null;
        const remoteId = typeof payload.remoteId === "string" ? payload.remoteId : null;
        context.log?.("info", "Iter2 execution mission executed", {
          executionId,
          releasePlanId,
          remoteId,
          shouldFail: payload.shouldFail === true
        });

        if (payload.shouldFail === true) {
          const error = new Error("Iter2 execution mission failed");
          error.code = "ITER2_EXECUTION_MISSION_FAILED";
          throw error;
        }

        return {
          ok: true,
          executionId,
          releasePlanId,
          remoteId,
          simulated: true
        };
      }
    }
  });
}
