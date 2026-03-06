import {
  defaultStructuredObjectCollectionFieldValue,
  normalizeStructuredObjectCollectionFieldConstraints,
  normalizeStructuredObjectCollectionFieldDefaultValue,
  normalizeStructuredObjectCollectionFieldInputValue,
  normalizeStructuredObjectCollectionFieldStoredValue,
  validateStructuredObjectCollectionFieldInputValue
} from "../collection-field-type-plugin-registry.mjs";
import {
  resolveStructuredObjectSchemaFromDescriptor,
  summarizeStructuredObjectValue
} from "../structured-field-runtime.mjs";

const MODERATION_PROFILE_FIELD_TYPE = "wpx-moderation-profile";

const MODERATION_PROFILE_DEFAULT_SCHEMA = Object.freeze({
  properties: Object.freeze([
    Object.freeze({
      id: "mode",
      label: "Mode",
      type: "enum",
      required: true,
      options: Object.freeze(["open", "moderated", "strict"])
    }),
    Object.freeze({
      id: "sensitivity",
      label: "Sensitivity",
      type: "number",
      required: false,
      min: 0,
      max: 100
    }),
    Object.freeze({
      id: "reviewerGroup",
      label: "Reviewer Group",
      type: "text",
      required: false,
      minLength: 0,
      maxLength: 80
    }),
    Object.freeze({
      id: "channels",
      label: "Channels",
      type: "string-list",
      required: false,
      minItems: 0,
      maxItems: 6
    })
  ])
});

function cloneJsonValue(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== "object") {
    return value;
  }

  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function toDescriptorWithModerationSchema(fieldDescriptor = {}) {
  const normalizedConstraints = normalizeStructuredObjectCollectionFieldConstraints(
    fieldDescriptor,
    {
      strict: false
    }
  );

  const normalizedSchema =
    normalizedConstraints.ok === true &&
    Array.isArray(normalizedConstraints.descriptorPatch?.constraints?.objectSchema?.properties) &&
    normalizedConstraints.descriptorPatch.constraints.objectSchema.properties.length > 0
      ? normalizedConstraints.descriptorPatch.constraints.objectSchema
      : cloneJsonValue(MODERATION_PROFILE_DEFAULT_SCHEMA);

  return {
    ...(fieldDescriptor && typeof fieldDescriptor === "object" ? fieldDescriptor : {}),
    constraints: {
      ...(
        fieldDescriptor?.constraints && typeof fieldDescriptor.constraints === "object"
          ? fieldDescriptor.constraints
          : {}
      ),
      objectSchema: normalizedSchema
    }
  };
}

function normalizeModerationProfileDescriptorConstraints(rawField = {}, { strict = false } = {}) {
  const normalizedConstraints = normalizeStructuredObjectCollectionFieldConstraints(rawField, {
    strict
  });
  if (!normalizedConstraints.ok) {
    return normalizedConstraints;
  }

  const normalizedSchema =
    Array.isArray(normalizedConstraints.descriptorPatch?.constraints?.objectSchema?.properties) &&
    normalizedConstraints.descriptorPatch.constraints.objectSchema.properties.length > 0
      ? normalizedConstraints.descriptorPatch.constraints.objectSchema
      : cloneJsonValue(MODERATION_PROFILE_DEFAULT_SCHEMA);

  return {
    ok: true,
    descriptorPatch: {
      constraints: {
        objectSchema: normalizedSchema
      }
    }
  };
}

function normalizeModerationProfileDefaultValue(descriptor = {}, rawValue) {
  const descriptorWithSchema = toDescriptorWithModerationSchema(descriptor);
  return normalizeStructuredObjectCollectionFieldDefaultValue(descriptorWithSchema, rawValue);
}

function normalizeModerationProfileInputValue(rawValue, { fieldDescriptor } = {}) {
  const descriptorWithSchema = toDescriptorWithModerationSchema(fieldDescriptor);
  return normalizeStructuredObjectCollectionFieldInputValue(rawValue, {
    fieldDescriptor: descriptorWithSchema
  });
}

function normalizeModerationProfileStoredValue(rawValue, { explicitDefault = null, fieldDescriptor } = {}) {
  const descriptorWithSchema = toDescriptorWithModerationSchema(fieldDescriptor);
  return normalizeStructuredObjectCollectionFieldStoredValue(rawValue, {
    explicitDefault,
    fieldDescriptor: descriptorWithSchema
  });
}

function defaultModerationProfileValue({ fieldDescriptor } = {}) {
  const descriptorWithSchema = toDescriptorWithModerationSchema(fieldDescriptor);
  return defaultStructuredObjectCollectionFieldValue({
    fieldDescriptor: descriptorWithSchema
  });
}

function validateModerationProfileInputValue({ value, definition, fieldDescriptor } = {}) {
  const descriptorWithSchema = toDescriptorWithModerationSchema(fieldDescriptor);
  return validateStructuredObjectCollectionFieldInputValue({
    value,
    definition,
    fieldDescriptor: descriptorWithSchema
  });
}

function summarizeModerationProfileCellValue({ value, fieldDescriptor } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "-";
  }

  if (typeof value.mode === "string" && value.mode.length > 0) {
    const sensitivity =
      typeof value.sensitivity === "number" && Number.isFinite(value.sensitivity)
        ? `${Math.round(value.sensitivity)}`
        : "n/a";
    return `${value.mode}:${sensitivity}`;
  }

  const schemaResult = resolveStructuredObjectSchemaFromDescriptor(
    toDescriptorWithModerationSchema(fieldDescriptor),
    {
      strict: false
    }
  );

  return summarizeStructuredObjectValue(value, schemaResult.ok ? schemaResult.value : null);
}

const MODERATION_PROFILE_FIELD_TYPE_PLUGIN = Object.freeze({
  type: MODERATION_PROFILE_FIELD_TYPE,
  schema: Object.freeze({
    kind: "json"
  }),
  normalizeDescriptorConstraints: normalizeModerationProfileDescriptorConstraints,
  normalizeDefaultValue: normalizeModerationProfileDefaultValue,
  runtime: Object.freeze({
    normalizeInputValue: normalizeModerationProfileInputValue,
    normalizeStoredValue: normalizeModerationProfileStoredValue,
    defaultValue: defaultModerationProfileValue,
    validateInputValue: validateModerationProfileInputValue
  }),
  frontend: Object.freeze({
    editor: Object.freeze({
      variant: "structured-object"
    }),
    cell: Object.freeze({
      variant: "structured-summary",
      summarizeValue: summarizeModerationProfileCellValue
    })
  }),
  query: Object.freeze({
    supported: false,
    codeSuffix: "FILTER_UNSUPPORTED",
    message: "Moderation profile fields do not support filtering"
  })
});

const MODERATION_PROFILE_FIELD_TYPE_PLUGINS = Object.freeze([MODERATION_PROFILE_FIELD_TYPE_PLUGIN]);

function registerCollectionFieldTypePlugins() {
  return MODERATION_PROFILE_FIELD_TYPE_PLUGINS;
}

export {
  MODERATION_PROFILE_FIELD_TYPE_PLUGINS,
  MODERATION_PROFILE_FIELD_TYPE,
  MODERATION_PROFILE_FIELD_TYPE_PLUGIN,
  registerCollectionFieldTypePlugins
};
