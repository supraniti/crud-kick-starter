export function registerServices({ registry }) {
  registry.register({
    serviceId: "iter3-drill-run-index-service",
    moduleId: "iter3-drill-runs",
    service: {
      label: "Iter3 Drill Run Index Service",
      description: "Provides runtime metadata for iter3 drill-run indexing and status refresh."
    }
  });
}

const ITER3_DRILL_RUN_MISSION_PAYLOAD_FIELDS = Object.freeze([
  {
    id: "drillRunId",
    label: "Drill Run Id",
    type: "text",
    required: false,
    description: "Optional iter3 drill-run id to associate with this mission run.",
    placeholder: "idr-001",
    defaultValue: null
  },
  {
    id: "drillPlanId",
    label: "Drill Plan Id",
    type: "text",
    required: false,
    description: "Optional drill-plan id for deterministic replay metadata.",
    placeholder: "idp-001",
    defaultValue: null
  },
  {
    id: "remoteId",
    label: "Remote Id",
    type: "text",
    required: false,
    description: "Optional remote id routed through the drill mission.",
    placeholder: "remote-001",
    defaultValue: null
  },
  {
    id: "missionId",
    label: "Mission Id",
    type: "text",
    required: false,
    description: "Optional downstream mission id for drill runtime correlation.",
    placeholder: "remote-deploy-mission",
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
        code: "ITER3_DRILL_RUN_MISSION_PAYLOAD_INVALID",
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
        code: "ITER3_DRILL_RUN_MISSION_PAYLOAD_INVALID",
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

function validateIter3DrillRunMissionPayload(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      ok: false,
      error: {
        code: "ITER3_DRILL_RUN_MISSION_PAYLOAD_INVALID",
        message: "Iter3 drill-run mission payload must be an object"
      }
    };
  }

  const normalizedDrillRunId = normalizeOptionalStringField(
    payload.drillRunId,
    "drillRunId",
    "drillRunId must be a non-empty string when provided"
  );
  if (!normalizedDrillRunId.ok) {
    return normalizedDrillRunId;
  }

  const normalizedDrillPlanId = normalizeOptionalStringField(
    payload.drillPlanId,
    "drillPlanId",
    "drillPlanId must be a non-empty string when provided"
  );
  if (!normalizedDrillPlanId.ok) {
    return normalizedDrillPlanId;
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
        code: "ITER3_DRILL_RUN_MISSION_PAYLOAD_INVALID",
        message: "shouldFail must be a boolean when provided",
        fieldId: "shouldFail"
      }
    };
  }

  return {
    ok: true,
    payload: {
      drillRunId: normalizedDrillRunId.value,
      drillPlanId: normalizedDrillPlanId.value,
      remoteId: normalizedRemoteId.value,
      missionId: normalizedMissionId.value,
      shouldFail: payload.shouldFail === true
    }
  };
}

export function registerMissions({ registry }) {
  registry.register({
    missionId: "iter3-drill-run-mission",
    moduleId: "iter3-drill-runs",
    mission: {
      label: "Iter3 Drill Run Mission",
      description: "Runs a deterministic drill simulation for iter3 incident workflows.",
      payload: {
        fields: ITER3_DRILL_RUN_MISSION_PAYLOAD_FIELDS.map((field) => ({
          ...field
        }))
      },
      validatePayload: validateIter3DrillRunMissionPayload,
      execute: async (payload = {}, context = {}) => {
        const drillRunId =
          typeof payload.drillRunId === "string" ? payload.drillRunId : null;
        const drillPlanId =
          typeof payload.drillPlanId === "string" ? payload.drillPlanId : null;
        const remoteId = typeof payload.remoteId === "string" ? payload.remoteId : null;
        const missionId = typeof payload.missionId === "string" ? payload.missionId : null;

        context.log?.("info", "Iter3 drill-run mission executed", {
          drillRunId,
          drillPlanId,
          remoteId,
          missionId,
          shouldFail: payload.shouldFail === true
        });

        if (payload.shouldFail === true) {
          const error = new Error("Iter3 drill-run mission failed");
          error.code = "ITER3_DRILL_RUN_MISSION_FAILED";
          throw error;
        }

        return {
          ok: true,
          drillRunId,
          drillPlanId,
          remoteId,
          missionId,
          terminalState: "succeeded",
          simulated: true
        };
      }
    }
  });
}
