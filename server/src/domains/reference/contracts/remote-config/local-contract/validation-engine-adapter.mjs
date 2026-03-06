export const VALIDATION_ENGINE_ID = "deterministic-object-adapter-v1";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeError(error, fallbackCode, fallbackMessage, fallbackFieldId = null) {
  if (!error || typeof error !== "object") {
    return {
      code: fallbackCode,
      message: fallbackMessage,
      ...(fallbackFieldId !== null ? { fieldId: fallbackFieldId } : {})
    };
  }

  const normalized = {
    code:
      typeof error.code === "string" && error.code.length > 0 ? error.code : fallbackCode,
    message:
      typeof error.message === "string" && error.message.length > 0
        ? error.message
        : fallbackMessage
  };

  if (error.fieldId !== undefined && error.fieldId !== null) {
    normalized.fieldId = error.fieldId;
  } else if (fallbackFieldId !== null) {
    normalized.fieldId = fallbackFieldId;
  }

  return normalized;
}

export function createObjectValidationAdapter({
  schemaId,
  objectError,
  unknownFieldError,
  fields
}) {
  if (typeof schemaId !== "string" || schemaId.length === 0) {
    throw new Error("schemaId is required");
  }

  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    throw new Error("fields must be an object");
  }

  const fieldIds = Object.keys(fields);
  const allowedFieldIds = new Set(fieldIds);

  if (fieldIds.length === 0) {
    throw new Error("at least one field definition is required");
  }

  const normalizedObjectError = normalizeError(
    objectError,
    "VALIDATION_OBJECT_INVALID",
    "Validation payload must be an object"
  );

  return {
    metadata: {
      engineId: VALIDATION_ENGINE_ID,
      schemaId,
      fieldIds: [...fieldIds]
    },
    validate(input) {
      if (!isPlainObject(input)) {
        return {
          ok: false,
          error: { ...normalizedObjectError }
        };
      }

      for (const fieldId of Object.keys(input)) {
        if (!allowedFieldIds.has(fieldId)) {
          return {
            ok: false,
            error: normalizeError(
              typeof unknownFieldError === "function"
                ? unknownFieldError(fieldId)
                : {
                    code: "VALIDATION_FIELD_UNKNOWN",
                    message: `Validation field '${fieldId}' is not supported`,
                    fieldId
                  },
              "VALIDATION_FIELD_UNKNOWN",
              `Validation field '${fieldId}' is not supported`,
              fieldId
            )
          };
        }
      }

      const value = {};
      for (const fieldId of fieldIds) {
        const fieldConfig = fields[fieldId];
        const normalize =
          fieldConfig && typeof fieldConfig.normalize === "function"
            ? fieldConfig.normalize
            : (rawValue) => ({
                ok: true,
                value: rawValue
              });

        let fieldResult;
        try {
          fieldResult = normalize(input[fieldId], {
            fieldId,
            input
          });
        } catch (error) {
          return {
            ok: false,
            error: normalizeError(
              {
                code: error?.code ?? "VALIDATION_FIELD_EVALUATION_FAILED",
                message: error?.message ?? `Validation for field '${fieldId}' failed`,
                fieldId
              },
              "VALIDATION_FIELD_EVALUATION_FAILED",
              `Validation for field '${fieldId}' failed`,
              fieldId
            )
          };
        }

        if (!fieldResult || fieldResult.ok !== true) {
          return {
            ok: false,
            error: normalizeError(
              fieldResult?.error,
              "VALIDATION_FIELD_INVALID",
              `Validation failed for field '${fieldId}'`,
              fieldId
            )
          };
        }

        value[fieldId] = fieldResult.value;
      }

      return {
        ok: true,
        value
      };
    }
  };
}
