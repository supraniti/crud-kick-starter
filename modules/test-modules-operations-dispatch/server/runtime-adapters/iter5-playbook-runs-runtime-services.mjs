export function registerServices({ registry }) {
  registry.register({
    serviceId: "iter5-playbook-run-index-service",
    moduleId: "iter5-playbook-runs",
    service: {
      label: "Iter5 Playbook Run Index Service",
      description:
        "Provides runtime metadata for iter5 playbook-run indexing and status refresh."
    }
  });
}

const ITER5_PLAYBOOK_RUN_MISSION_PAYLOAD_FIELDS = Object.freeze([
  {
    id: "playbookRunId",
    label: "Playbook Run Id",
    type: "text",
    required: false,
    description: "Optional iter5 playbook-run id to associate with this mission run.",
    placeholder: "i5r-001",
    defaultValue: null
  },
  {
    id: "playbookId",
    label: "Playbook Id",
    type: "text",
    required: false,
    description: "Optional playbook id for deterministic replay metadata.",
    placeholder: "i5p-001",
    defaultValue: null
  },
  {
    id: "remoteId",
    label: "Remote Id",
    type: "text",
    required: false,
    description: "Optional remote id routed through the mission.",
    placeholder: "remote-001",
    defaultValue: null
  },
  {
    id: "missionId",
    label: "Mission Id",
    type: "text",
    required: false,
    description: "Optional downstream mission id for runtime correlation.",
    placeholder: "iter5-playbook-run-mission",
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
        code: "ITER5_PLAYBOOK_RUN_MISSION_PAYLOAD_INVALID",
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
        code: "ITER5_PLAYBOOK_RUN_MISSION_PAYLOAD_INVALID",
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

function validateIter5PlaybookRunMissionPayload(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      ok: false,
      error: {
        code: "ITER5_PLAYBOOK_RUN_MISSION_PAYLOAD_INVALID",
        message: "Iter5 playbook-run mission payload must be an object"
      }
    };
  }

  const normalizedPlaybookRunId = normalizeOptionalStringField(
    payload.playbookRunId,
    "playbookRunId",
    "playbookRunId must be a non-empty string when provided"
  );
  if (!normalizedPlaybookRunId.ok) {
    return normalizedPlaybookRunId;
  }

  const normalizedPlaybookId = normalizeOptionalStringField(
    payload.playbookId,
    "playbookId",
    "playbookId must be a non-empty string when provided"
  );
  if (!normalizedPlaybookId.ok) {
    return normalizedPlaybookId;
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
        code: "ITER5_PLAYBOOK_RUN_MISSION_PAYLOAD_INVALID",
        message: "shouldFail must be a boolean when provided",
        fieldId: "shouldFail"
      }
    };
  }

  return {
    ok: true,
    payload: {
      playbookRunId: normalizedPlaybookRunId.value,
      playbookId: normalizedPlaybookId.value,
      remoteId: normalizedRemoteId.value,
      missionId: normalizedMissionId.value,
      shouldFail: payload.shouldFail === true
    }
  };
}

export function registerMissions({ registry }) {
  registry.register({
    missionId: "iter5-playbook-run-mission",
    moduleId: "iter5-playbook-runs",
    mission: {
      label: "Iter5 Playbook Run Mission",
      description: "Runs deterministic playbook execution simulation for iter5 workflows.",
      payload: {
        fields: ITER5_PLAYBOOK_RUN_MISSION_PAYLOAD_FIELDS.map((field) => ({
          ...field
        }))
      },
      validatePayload: validateIter5PlaybookRunMissionPayload,
      execute: async (payload = {}, context = {}) => {
        const playbookRunId =
          typeof payload.playbookRunId === "string" ? payload.playbookRunId : null;
        const playbookId =
          typeof payload.playbookId === "string" ? payload.playbookId : null;
        const remoteId = typeof payload.remoteId === "string" ? payload.remoteId : null;
        const missionId = typeof payload.missionId === "string" ? payload.missionId : null;

        context.log?.("info", "Iter5 playbook-run mission executed", {
          playbookRunId,
          playbookId,
          remoteId,
          missionId,
          shouldFail: payload.shouldFail === true
        });

        if (payload.shouldFail === true) {
          const error = new Error("Iter5 playbook-run mission failed");
          error.code = "ITER5_PLAYBOOK_RUN_MISSION_FAILED";
          throw error;
        }

        return {
          ok: true,
          playbookRunId,
          playbookId,
          remoteId,
          missionId,
          terminalState: "succeeded",
          simulated: true
        };
      }
    }
  });
}
