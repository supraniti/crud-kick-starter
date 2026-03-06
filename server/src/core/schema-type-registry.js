const SUPPORTED_CONTRACT_VERSION = 1;
const TYPE_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SUPPORTED_FIELD_KINDS = new Set(["text", "number", "boolean", "ref", "json"]);

function errorShape(code, message, field = null) {
  return {
    code,
    message,
    field
  };
}

function normalizeFieldDescriptor(fieldKey, descriptor) {
  if (!descriptor || typeof descriptor !== "object") {
    return {
      ok: false,
      error: errorShape(
        "SCHEMA_FIELD_DESCRIPTOR_INVALID",
        `Field descriptor must be an object for '${fieldKey}'`,
        `fields.${fieldKey}`
      )
    };
  }

  if (
    typeof descriptor.kind !== "string" ||
    !SUPPORTED_FIELD_KINDS.has(descriptor.kind)
  ) {
    return {
      ok: false,
      error: errorShape(
        "SCHEMA_FIELD_DESCRIPTOR_INVALID",
        `Unsupported field kind for '${fieldKey}'`,
        `fields.${fieldKey}.kind`
      )
    };
  }

  if (descriptor.kind === "ref" && typeof descriptor.refType !== "string") {
    return {
      ok: false,
      error: errorShape(
        "SCHEMA_FIELD_DESCRIPTOR_INVALID",
        `Ref field '${fieldKey}' must define refType`,
        `fields.${fieldKey}.refType`
      )
    };
  }

  return {
    ok: true,
    value: {
      kind: descriptor.kind,
      required: Boolean(descriptor.required),
      ...(descriptor.kind === "ref" ? { refType: descriptor.refType } : {})
    }
  };
}

export function validateTypeDefinition(input) {
  const definition = input ?? {};

  if (definition.contractVersion !== SUPPORTED_CONTRACT_VERSION) {
    return {
      ok: false,
      error: errorShape(
        "SCHEMA_TYPE_CONTRACT_VERSION_UNSUPPORTED",
        `Unsupported schema type contract version: ${definition.contractVersion}`,
        "contractVersion"
      )
    };
  }

  if (
    typeof definition.typeKey !== "string" ||
    !TYPE_KEY_PATTERN.test(definition.typeKey)
  ) {
    return {
      ok: false,
      error: errorShape(
        "SCHEMA_TYPE_KEY_INVALID",
        "typeKey must be lowercase kebab-case",
        "typeKey"
      )
    };
  }

  if (!definition.fields || typeof definition.fields !== "object") {
    return {
      ok: false,
      error: errorShape(
        "SCHEMA_TYPE_INVALID",
        "fields object is required",
        "fields"
      )
    };
  }

  const fieldEntries = Object.entries(definition.fields);
  if (fieldEntries.length === 0) {
    return {
      ok: false,
      error: errorShape(
        "SCHEMA_TYPE_INVALID",
        "At least one field descriptor is required",
        "fields"
      )
    };
  }

  const normalizedFields = {};
  for (const [fieldKey, descriptor] of fieldEntries) {
    const normalized = normalizeFieldDescriptor(fieldKey, descriptor);
    if (!normalized.ok) {
      return normalized;
    }

    normalizedFields[fieldKey] = normalized.value;
  }

  return {
    ok: true,
    value: {
      contractVersion: SUPPORTED_CONTRACT_VERSION,
      typeKey: definition.typeKey,
      fields: normalizedFields,
      computed:
        definition.computed && typeof definition.computed === "object"
          ? definition.computed
          : {},
      metadata:
        definition.metadata && typeof definition.metadata === "object"
          ? definition.metadata
          : {}
    }
  };
}

function matchesKind(descriptor, value) {
  if (descriptor.kind === "text") {
    return typeof value === "string";
  }

  if (descriptor.kind === "number") {
    return typeof value === "number" && Number.isFinite(value);
  }

  if (descriptor.kind === "boolean") {
    return typeof value === "boolean";
  }

  if (descriptor.kind === "ref") {
    return typeof value === "string";
  }

  if (descriptor.kind === "json") {
    return typeof value === "object" && value !== null;
  }

  return false;
}

function registryError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function createSchemaTypeRegistry() {
  const definitions = new Map();

  return {
    register(definition) {
      const validation = validateTypeDefinition(definition);
      if (!validation.ok) {
        const error = registryError("SCHEMA_TYPE_INVALID", validation.error.message);
        error.details = validation.error;
        throw error;
      }

      definitions.set(validation.value.typeKey, validation.value);
      return validation.value;
    },
    get(typeKey) {
      return definitions.get(typeKey) ?? null;
    },
    list() {
      return Array.from(definitions.values());
    },
    validateItem(typeKey, item) {
      const definition = definitions.get(typeKey);
      if (!definition) {
        return {
          ok: false,
          errors: [
            errorShape(
              "SCHEMA_TYPE_NOT_FOUND",
              `Type '${typeKey}' is not registered`,
              "typeKey"
            )
          ]
        };
      }

      const payload = item ?? {};
      const errors = [];

      for (const [fieldKey, descriptor] of Object.entries(definition.fields)) {
        const value = payload[fieldKey];
        const isMissing = value === undefined || value === null;

        if (descriptor.required && isMissing) {
          errors.push(
            errorShape(
              "SCHEMA_ITEM_REQUIRED_FIELD_MISSING",
              `Required field '${fieldKey}' is missing`,
              fieldKey
            )
          );
          continue;
        }

        if (isMissing) {
          continue;
        }

        if (!matchesKind(descriptor, value)) {
          errors.push(
            errorShape(
              "SCHEMA_ITEM_FIELD_TYPE_MISMATCH",
              `Field '${fieldKey}' does not match kind '${descriptor.kind}'`,
              fieldKey
            )
          );
        }
      }

      return {
        ok: errors.length === 0,
        errors
      };
    }
  };
}
