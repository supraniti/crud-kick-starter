const REQUESTED_STATUS_OPTIONS = new Set(["published", "scheduled"]);

const WPX_PUBLISH_MISSION_PAYLOAD_FIELDS = Object.freeze([
  {
    id: "postId",
    label: "Post Id",
    type: "text",
    required: true,
    description: "Post id for publish pipeline replay.",
    placeholder: "wpp-001",
    defaultValue: null
  },
  {
    id: "requestedStatus",
    label: "Requested Status",
    type: "enum",
    required: true,
    description: "Requested lifecycle status for this publish run.",
    defaultValue: "published",
    options: [
      {
        value: "published",
        label: "Published"
      },
      {
        value: "scheduled",
        label: "Scheduled"
      }
    ]
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

function normalizeRequiredStringField(rawValue, fieldId, message) {
  if (typeof rawValue !== "string") {
    return {
      ok: false,
      error: {
        code: "WPX_PUBLISH_MISSION_PAYLOAD_INVALID",
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
        code: "WPX_PUBLISH_MISSION_PAYLOAD_INVALID",
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

function validateWpxPublishMissionPayload(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      ok: false,
      error: {
        code: "WPX_PUBLISH_MISSION_PAYLOAD_INVALID",
        message: "WPX publish mission payload must be an object"
      }
    };
  }

  const postId = normalizeRequiredStringField(
    payload.postId,
    "postId",
    "postId must be a non-empty string"
  );
  if (!postId.ok) {
    return postId;
  }

  const requestedStatus = normalizeRequiredStringField(
    payload.requestedStatus,
    "requestedStatus",
    "requestedStatus must be a non-empty string"
  );
  if (!requestedStatus.ok) {
    return requestedStatus;
  }
  if (!REQUESTED_STATUS_OPTIONS.has(requestedStatus.value)) {
    return {
      ok: false,
      error: {
        code: "WPX_PUBLISH_MISSION_PAYLOAD_INVALID",
        message: "requestedStatus must be one of: published, scheduled",
        fieldId: "requestedStatus"
      }
    };
  }

  if (
    payload.shouldFail !== undefined &&
    payload.shouldFail !== null &&
    typeof payload.shouldFail !== "boolean"
  ) {
    return {
      ok: false,
      error: {
        code: "WPX_PUBLISH_MISSION_PAYLOAD_INVALID",
        message: "shouldFail must be boolean when provided",
        fieldId: "shouldFail"
      }
    };
  }

  return {
    ok: true,
    payload: {
      postId: postId.value,
      requestedStatus: requestedStatus.value,
      shouldFail: payload.shouldFail === true
    }
  };
}

function normalizePolicyMode(profile) {
  const rawMode = typeof profile?.policyMode === "string" ? profile.policyMode : "direct";
  return rawMode === "moderated" ? "moderated" : "direct";
}

function normalizeDiscussionMode(profile) {
  const rawMode =
    typeof profile?.discussionBehavior === "string" ? profile.discussionBehavior : "open";
  return ["open", "moderated", "closed"].includes(rawMode) ? rawMode : "open";
}

export function registerMissions({ registry }) {
  registry.register({
    missionId: "wpx-publish-pipeline-mission",
    moduleId: "wpx-publish-jobs",
    mission: {
      label: "WPX Publish Pipeline Mission",
      description: "Runs the publish-policy decision pipeline and returns deterministic terminal state.",
      payload: {
        fields: WPX_PUBLISH_MISSION_PAYLOAD_FIELDS.map((field) => ({
          ...field
        }))
      },
      validatePayload: validateWpxPublishMissionPayload,
      execute: async (payload = {}, context = {}) => {
        const policyService = context.getService?.("settings-policy-service");
        const activeProfile =
          policyService && typeof policyService.readActiveProfile === "function"
            ? await policyService.readActiveProfile()
            : null;

        const policyMode = normalizePolicyMode(activeProfile);
        const discussionBehavior = normalizeDiscussionMode(activeProfile);

        context.log?.("info", "WPX publish mission executed", {
          postId: payload.postId,
          requestedStatus: payload.requestedStatus,
          policyMode,
          discussionBehavior,
          shouldFail: payload.shouldFail === true
        });

        if (payload.shouldFail === true) {
          const error = new Error("WPX publish pipeline mission failed");
          error.code = "WPX_PUBLISH_PIPELINE_MISSION_FAILED";
          throw error;
        }

        const blocked =
          payload.requestedStatus === "published" &&
          policyMode === "moderated" &&
          discussionBehavior !== "open";

        return {
          postId: payload.postId,
          requestedStatus: payload.requestedStatus,
          policyMode,
          discussionBehavior,
          terminalState: blocked ? "blocked" : "completed"
        };
      }
    }
  });
}
