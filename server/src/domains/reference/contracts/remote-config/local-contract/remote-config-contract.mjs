import { createObjectValidationAdapter } from "./validation-engine-adapter.mjs";

export const REMOTE_CONFIG_KINDS = ["filesystem", "http", "sftp"];

const REMOTE_CONFIG_KIND_SET = new Set(REMOTE_CONFIG_KINDS);

export function normalizeRemoteKind(kind) {
  if (typeof kind !== "string") {
    return "";
  }

  return kind.trim().toLowerCase();
}

function buildRemoteConfigValue(normalizedValue, partial) {
  if (!partial) {
    return {
      label: normalizedValue.label,
      kind: normalizedValue.kind,
      endpoint: normalizedValue.endpoint,
      enabled: normalizedValue.enabled
    };
  }

  return {
    label: normalizedValue.label ?? "",
    kind: normalizedValue.kind ?? "",
    endpoint: normalizedValue.endpoint ?? "",
    enabled: normalizedValue.enabled === true
  };
}

function createRemoteConfigValidator({ partial }) {
  return createObjectValidationAdapter({
    schemaId: partial ? "remote-config-input-partial-v1" : "remote-config-input-v1",
    objectError: {
      code: "REMOTE_INPUT_INVALID",
      message: "Remote input must be an object"
    },
    unknownFieldError: (fieldId) => ({
      code: "REMOTE_FIELD_UNKNOWN",
      message: `Remote field '${fieldId}' is not supported`,
      fieldId
    }),
    fields: {
      label: {
        normalize: (rawValue) => {
          if (rawValue === undefined && partial) {
            return {
              ok: true,
              value: undefined
            };
          }

          const trimmed = typeof rawValue === "string" ? rawValue.trim() : "";
          if (trimmed.length === 0) {
            return {
              ok: false,
              error: {
                code: "REMOTE_LABEL_REQUIRED",
                message: "Remote label is required",
                fieldId: "label"
              }
            };
          }

          return {
            ok: true,
            value: trimmed
          };
        }
      },
      kind: {
        normalize: (rawValue) => {
          if (rawValue === undefined && partial) {
            return {
              ok: true,
              value: undefined
            };
          }

          const normalized = normalizeRemoteKind(rawValue);
          if (!REMOTE_CONFIG_KIND_SET.has(normalized)) {
            return {
              ok: false,
              error: {
                code: "REMOTE_KIND_INVALID",
                message: "Remote kind must be one of: filesystem, http, sftp",
                fieldId: "kind"
              }
            };
          }

          return {
            ok: true,
            value: normalized
          };
        }
      },
      endpoint: {
        normalize: (rawValue) => {
          if (rawValue === undefined && partial) {
            return {
              ok: true,
              value: undefined
            };
          }

          const trimmed = typeof rawValue === "string" ? rawValue.trim() : "";
          if (trimmed.length === 0) {
            return {
              ok: false,
              error: {
                code: "REMOTE_ENDPOINT_REQUIRED",
                message: "Remote endpoint is required",
                fieldId: "endpoint"
              }
            };
          }

          return {
            ok: true,
            value: trimmed
          };
        }
      },
      enabled: {
        normalize: (rawValue) => {
          if (rawValue === undefined && partial) {
            return {
              ok: true,
              value: undefined
            };
          }

          if (typeof rawValue !== "boolean") {
            return {
              ok: false,
              error: {
                code: "REMOTE_ENABLED_INVALID",
                message: "Remote enabled value must be boolean",
                fieldId: "enabled"
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
}

const remoteConfigValidator = createRemoteConfigValidator({
  partial: false
});

const remoteConfigPartialValidator = createRemoteConfigValidator({
  partial: true
});

export function getRemoteConfigValidationAdapterMetadata(options = {}) {
  const partial = options.partial === true;
  const metadata = partial
    ? remoteConfigPartialValidator.metadata
    : remoteConfigValidator.metadata;

  return {
    ...metadata,
    fieldIds: [...metadata.fieldIds]
  };
}

export function validateRemoteConfigInput(input, options = {}) {
  const partial = options.partial === true;
  const validation = partial
    ? remoteConfigPartialValidator.validate(input)
    : remoteConfigValidator.validate(input);

  if (!validation.ok) {
    return {
      ok: false,
      errors: [validation.error]
    };
  }

  return {
    ok: true,
    value: buildRemoteConfigValue(validation.value, partial)
  };
}

export function normalizeRemoteConfigInput(input, options = {}) {
  const result = validateRemoteConfigInput(input, options);
  if (!result.ok) {
    return null;
  }

  return result.value;
}
