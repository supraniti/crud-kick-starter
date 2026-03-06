import { createObjectValidationAdapter } from "./validation-engine-adapter.mjs";

const REMOTE_DEPLOY_PAYLOAD_FIELDS = [
  {
    id: "remoteId",
    label: "Remote Id",
    type: "text",
    required: false,
    description: "Optional target remote id for deployment simulation.",
    placeholder: "remote-001",
    defaultValue: null
  },
  {
    id: "shouldFail",
    label: "Force Failure",
    type: "boolean",
    required: false,
    description: "Forces a deterministic mission failure response.",
    defaultValue: false
  }
];

const remoteDeployPayloadValidator = createObjectValidationAdapter({
  schemaId: "remote-deploy-mission-payload-v1",
  objectError: {
    code: "REMOTE_DEPLOY_PAYLOAD_INVALID",
    message: "Remote deploy payload must be an object"
  },
  unknownFieldError: (fieldId) => ({
    code: "REMOTE_DEPLOY_PAYLOAD_FIELD_UNKNOWN",
    message: `Remote deploy payload field '${fieldId}' is not supported`,
    fieldId
  }),
  fields: {
    remoteId: {
      normalize: (rawValue) => {
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
              code: "REMOTE_DEPLOY_PAYLOAD_REMOTE_ID_INVALID",
              message: "remoteId must be a string when provided",
              fieldId: "remoteId"
            }
          };
        }

        const trimmedRemoteId = rawValue.trim();
        if (trimmedRemoteId.length === 0) {
          return {
            ok: false,
            error: {
              code: "REMOTE_DEPLOY_PAYLOAD_REMOTE_ID_INVALID",
              message: "remoteId must be non-empty when provided",
              fieldId: "remoteId"
            }
          };
        }

        return {
          ok: true,
          value: trimmedRemoteId
        };
      }
    },
    shouldFail: {
      normalize: (rawValue) => {
        if (rawValue === undefined) {
          return {
            ok: true,
            value: false
          };
        }

        if (typeof rawValue !== "boolean") {
          return {
            ok: false,
            error: {
              code: "REMOTE_DEPLOY_PAYLOAD_SHOULD_FAIL_INVALID",
              message: "shouldFail must be a boolean",
              fieldId: "shouldFail"
            }
          };
        }

        return {
          ok: true,
          value: rawValue === true
        };
      }
    }
  }
});

export function listRemoteDeployPayloadFields() {
  return REMOTE_DEPLOY_PAYLOAD_FIELDS.map((field) => ({
    ...field
  }));
}

export function getRemoteDeployPayloadValidationAdapterMetadata() {
  return {
    ...remoteDeployPayloadValidator.metadata,
    fieldIds: [...remoteDeployPayloadValidator.metadata.fieldIds]
  };
}

export function validateRemoteDeployPayload(payload = {}) {
  const validation = remoteDeployPayloadValidator.validate(payload);
  if (!validation.ok) {
    return validation;
  }
  return {
    ok: true,
    payload: {
      remoteId: validation.value.remoteId,
      shouldFail: validation.value.shouldFail === true
    }
  };
}
