export function registerServices({ registry }) {
  registry.register({
    serviceId: "iter4-dispatch-run-index-service",
    moduleId: "iter4-dispatch-runs",
    service: {
      label: "Iter4 Dispatch Run Index Service",
      description:
        "Provides runtime metadata for iter4 dispatch-run indexing and status refresh."
    }
  });
}

const ITER4_DISPATCH_RUN_MISSION_PAYLOAD_FIELDS = Object.freeze([
  {
    id: "dispatchRunId",
    label: "Dispatch Run Id",
    type: "text",
    required: false,
    description: "Optional iter4 dispatch-run id to associate with this mission run.",
    placeholder: "i4d-001",
    defaultValue: null
  },
  {
    id: "responsePlanId",
    label: "Response Plan Id",
    type: "text",
    required: false,
    description: "Optional iter4 response-plan id for deterministic replay metadata.",
    placeholder: "i4p-001",
    defaultValue: null
  },
  {
    id: "remoteId",
    label: "Remote Id",
    type: "text",
    required: false,
    description: "Optional remote id routed through the dispatch mission.",
    placeholder: "remote-001",
    defaultValue: null
  },
  {
    id: "missionId",
    label: "Mission Id",
    type: "text",
    required: false,
    description: "Optional downstream mission id for dispatch runtime correlation.",
    placeholder: "iter4-dispatch-run-mission",
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
        code: "ITER4_DISPATCH_MISSION_PAYLOAD_INVALID",
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
        code: "ITER4_DISPATCH_MISSION_PAYLOAD_INVALID",
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

function validateIter4DispatchMissionPayload(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      ok: false,
      error: {
        code: "ITER4_DISPATCH_MISSION_PAYLOAD_INVALID",
        message: "Iter4 dispatch mission payload must be an object"
      }
    };
  }

  const normalizedDispatchRunId = normalizeOptionalStringField(
    payload.dispatchRunId,
    "dispatchRunId",
    "dispatchRunId must be a non-empty string when provided"
  );
  if (!normalizedDispatchRunId.ok) {
    return normalizedDispatchRunId;
  }

  const normalizedResponsePlanId = normalizeOptionalStringField(
    payload.responsePlanId,
    "responsePlanId",
    "responsePlanId must be a non-empty string when provided"
  );
  if (!normalizedResponsePlanId.ok) {
    return normalizedResponsePlanId;
  }

  const normalizedRemoteId = normalizeOptionalStringField(
    payload.remoteId,
    "remoteId",
    "remoteId must be a non-empty string when provided"
  );
  if (!normalizedRemoteId.ok) {
    return normalizedRemoteId;
  }

  const normalizedMissionId = normalizeOptionalStringField(
    payload.missionId,
    "missionId",
    "missionId must be a non-empty string when provided"
  );
  if (!normalizedMissionId.ok) {
    return normalizedMissionId;
  }

  if (
    payload.shouldFail !== undefined &&
    payload.shouldFail !== null &&
    typeof payload.shouldFail !== "boolean"
  ) {
    return {
      ok: false,
      error: {
        code: "ITER4_DISPATCH_MISSION_PAYLOAD_INVALID",
        message: "shouldFail must be a boolean when provided",
        fieldId: "shouldFail"
      }
    };
  }

  return {
    ok: true,
    payload: {
      dispatchRunId: normalizedDispatchRunId.value,
      responsePlanId: normalizedResponsePlanId.value,
      remoteId: normalizedRemoteId.value,
      missionId: normalizedMissionId.value,
      shouldFail: payload.shouldFail === true
    }
  };
}

export function registerMissions({ registry }) {
  registry.register({
    missionId: "iter4-dispatch-run-mission",
    moduleId: "iter4-dispatch-runs",
    mission: {
      label: "Iter4 Dispatch Run Mission",
      description: "Runs deterministic response dispatch simulation for iter4 workflows.",
      payload: {
        fields: ITER4_DISPATCH_RUN_MISSION_PAYLOAD_FIELDS.map((field) => ({
          ...field
        }))
      },
      validatePayload: validateIter4DispatchMissionPayload,
      execute: async (payload = {}, context = {}) => {
        const dispatchRunId =
          typeof payload.dispatchRunId === "string" ? payload.dispatchRunId : null;
        const responsePlanId =
          typeof payload.responsePlanId === "string" ? payload.responsePlanId : null;
        const remoteId = typeof payload.remoteId === "string" ? payload.remoteId : null;
        const missionId = typeof payload.missionId === "string" ? payload.missionId : null;

        context.log?.("info", "Iter4 dispatch-run mission executed", {
          dispatchRunId,
          responsePlanId,
          remoteId,
          missionId,
          shouldFail: payload.shouldFail === true
        });

        if (payload.shouldFail === true) {
          const error = new Error("Iter4 dispatch-run mission failed");
          error.code = "ITER4_DISPATCH_RUN_MISSION_FAILED";
          throw error;
        }

        return {
          ok: true,
          dispatchRunId,
          responsePlanId,
          remoteId,
          missionId,
          terminalState: "succeeded",
          simulated: true
        };
      }
    }
  });
}
