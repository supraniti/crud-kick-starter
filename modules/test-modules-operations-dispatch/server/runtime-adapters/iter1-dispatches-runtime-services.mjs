export function registerServices({ registry }) {
  registry.register({
    serviceId: "iter1-dispatches-index-service",
    moduleId: "iter1-dispatches",
    service: {
      label: "Iter1 Dispatches Index Service",
      description: "Provides runtime metadata for iter1 dispatch indexing and search refresh."
    }
  });
}

const ITER1_DISPATCH_MISSION_PAYLOAD_FIELDS = Object.freeze([
  {
    id: "dispatchId",
    label: "Dispatch Id",
    type: "text",
    required: false,
    description: "Optional iter1 dispatch id to associate with the mission run.",
    placeholder: "itd-001",
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
        code: "ITER1_DISPATCH_MISSION_PAYLOAD_INVALID",
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
        code: "ITER1_DISPATCH_MISSION_PAYLOAD_INVALID",
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

function validateDispatchMissionPayload(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      ok: false,
      error: {
        code: "ITER1_DISPATCH_MISSION_PAYLOAD_INVALID",
        message: "Dispatch mission payload must be an object"
      }
    };
  }

  const normalizedDispatchId = normalizeOptionalStringField(
    payload.dispatchId,
    "dispatchId",
    "dispatchId must be a non-empty string when provided"
  );
  if (!normalizedDispatchId.ok) {
    return normalizedDispatchId;
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
        code: "ITER1_DISPATCH_MISSION_PAYLOAD_INVALID",
        message: "shouldFail must be a boolean when provided",
        fieldId: "shouldFail"
      }
    };
  }

  return {
    ok: true,
    payload: {
      dispatchId: normalizedDispatchId.value,
      remoteId: normalizedRemoteId.value,
      shouldFail: payload.shouldFail === true
    }
  };
}

export function registerMissions({ registry }) {
  registry.register({
    missionId: "iter1-dispatch-mission",
    moduleId: "iter1-dispatches",
    mission: {
      label: "Iter1 Dispatch Mission",
      description: "Runs a deterministic dispatch execution simulation for iter1 flows.",
      payload: {
        fields: ITER1_DISPATCH_MISSION_PAYLOAD_FIELDS.map((field) => ({
          ...field
        }))
      },
      validatePayload: validateDispatchMissionPayload,
      execute: async (payload = {}, context = {}) => {
        const dispatchId = typeof payload.dispatchId === "string" ? payload.dispatchId : null;
        const remoteId = typeof payload.remoteId === "string" ? payload.remoteId : null;
        context.log?.("info", "Iter1 dispatch mission executed", {
          dispatchId,
          remoteId,
          shouldFail: payload.shouldFail === true
        });

        if (payload.shouldFail === true) {
          const error = new Error("Iter1 dispatch mission failed");
          error.code = "ITER1_DISPATCH_MISSION_FAILED";
          throw error;
        }

        return {
          ok: true,
          dispatchId,
          remoteId,
          simulated: true
        };
      }
    }
  });
}
