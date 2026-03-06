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

const TRACE_CODE_FIELD_TYPE = "iter5-trace-code";
const ANALYSIS_BUNDLE_FIELD_TYPE = "iter5-analysis-bundle";
const TRACE_CODE_PATTERN = /^[A-Z0-9-]+$/;

const ANALYSIS_BUNDLE_DEFAULT_SCHEMA = Object.freeze({
  properties: Object.freeze([
    Object.freeze({
      id: "stage",
      label: "Stage",
      type: "enum",
      required: true,
      options: Object.freeze(["triage", "investigation", "resolved"])
    }),
    Object.freeze({
      id: "confidence",
      label: "Confidence",
      type: "number",
      required: false,
      min: 0,
      max: 100
    }),
    Object.freeze({
      id: "notes",
      label: "Notes",
      type: "text",
      required: false,
      minLength: 0,
      maxLength: 180
    }),
    Object.freeze({
      id: "tags",
      label: "Tags",
      type: "string-list",
      required: false,
      minItems: 0,
      maxItems: 8
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

function normalizeNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function normalizeTraceCodeDescriptorConstraints(rawField = {}, { strict = false } = {}) {
  const minLength =
    rawField.minLength === undefined ? null : normalizeNonNegativeInteger(rawField.minLength);
  const maxLength =
    rawField.maxLength === undefined ? null : normalizeNonNegativeInteger(rawField.maxLength);

  if (strict && rawField.minLength !== undefined && minLength === null) {
    return {
      ok: false,
      reason: "minLength must be an integer >= 0"
    };
  }
  if (strict && rawField.maxLength !== undefined && maxLength === null) {
    return {
      ok: false,
      reason: "maxLength must be an integer >= 0"
    };
  }

  if (Number.isInteger(minLength) && Number.isInteger(maxLength) && maxLength < minLength) {
    if (strict) {
      return {
        ok: false,
        reason: "maxLength must be greater than or equal to minLength"
      };
    }

    return {
      ok: true,
      minLength: maxLength,
      maxLength: minLength
    };
  }

  return {
    ok: true,
    minLength,
    maxLength
  };
}

function normalizeTraceCodeDefaultValue(descriptor = {}, rawValue) {
  if (rawValue === null) {
    if (descriptor.required === true) {
      return {
        ok: false,
        reason: "defaultValue cannot be null when field is required"
      };
    }
    return {
      ok: true,
      value: null
    };
  }

  if (rawValue === undefined) {
    return {
      ok: true,
      value: null
    };
  }

  if (typeof rawValue !== "string") {
    return {
      ok: false,
      reason: "defaultValue must be a string or null"
    };
  }

  const normalized = rawValue.trim().toUpperCase();
  if (descriptor.required === true && normalized.length === 0) {
    return {
      ok: false,
      reason: "defaultValue cannot be empty when field is required"
    };
  }

  if (normalized.length > 0 && !TRACE_CODE_PATTERN.test(normalized)) {
    return {
      ok: false,
      reason: "defaultValue must include only A-Z, 0-9, and '-'"
    };
  }

  return {
    ok: true,
    value: normalized.length > 0 ? normalized : null
  };
}

function normalizeTraceCodeInputValue(rawValue) {
  if (rawValue === undefined || rawValue === null) {
    return null;
  }

  if (typeof rawValue !== "string") {
    return "__INVALID__";
  }

  const normalized = rawValue.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

function normalizeTraceCodeStoredValue(rawValue, { explicitDefault = null } = {}) {
  const normalized = normalizeTraceCodeInputValue(rawValue);
  if (normalized === "__INVALID__") {
    return explicitDefault;
  }

  return normalized;
}

function defaultTraceCodeValue() {
  return null;
}

function resolveTraceCodeValidationEntityTitle(definition) {
  return typeof definition?.entityTitle === "string" && definition.entityTitle.length > 0
    ? definition.entityTitle
    : "Item";
}

function resolveTraceCodeValidationFieldLabel(fieldDescriptor) {
  return typeof fieldDescriptor?.id === "string" && fieldDescriptor.id.length > 0
    ? fieldDescriptor.id
    : "field";
}

function createTraceCodeValidationError(codeSuffix, message) {
  return {
    codeSuffix,
    message
  };
}

function validateTraceCodeInputType(value, entityTitle, fieldLabel) {
  if (value === "__INVALID__") {
    return createTraceCodeValidationError(
      "INVALID",
      `${entityTitle} ${fieldLabel} must be a string`
    );
  }

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    return createTraceCodeValidationError(
      "INVALID",
      `${entityTitle} ${fieldLabel} must be a string`
    );
  }

  return null;
}

function validateTraceCodeRequiredValue(value, fieldDescriptor, entityTitle, fieldLabel) {
  if (fieldDescriptor?.required === true && (value === null || value === undefined)) {
    return createTraceCodeValidationError(
      "REQUIRED",
      `${entityTitle} ${fieldLabel} is required`
    );
  }

  return null;
}

function validateTraceCodePattern(value, entityTitle, fieldLabel) {
  if (!TRACE_CODE_PATTERN.test(value)) {
    return createTraceCodeValidationError(
      "INVALID_FORMAT",
      `${entityTitle} ${fieldLabel} must include only A-Z, 0-9, and '-'`
    );
  }

  return null;
}

function validateTraceCodeMinLength(value, fieldDescriptor, entityTitle, fieldLabel) {
  if (Number.isInteger(fieldDescriptor?.minLength) && value.length < fieldDescriptor.minLength) {
    return createTraceCodeValidationError(
      "TOO_SHORT",
      `${entityTitle} ${fieldLabel} must be at least ${fieldDescriptor.minLength} characters`
    );
  }

  return null;
}

function validateTraceCodeMaxLength(value, fieldDescriptor, entityTitle, fieldLabel) {
  if (Number.isInteger(fieldDescriptor?.maxLength) && value.length > fieldDescriptor.maxLength) {
    return createTraceCodeValidationError(
      "TOO_LONG",
      `${entityTitle} ${fieldLabel} must be at most ${fieldDescriptor.maxLength} characters`
    );
  }

  return null;
}

function validateTraceCodeInputValue({ value, definition, fieldDescriptor } = {}) {
  const entityTitle = resolveTraceCodeValidationEntityTitle(definition);
  const fieldLabel = resolveTraceCodeValidationFieldLabel(fieldDescriptor);
  const typeError = validateTraceCodeInputType(value, entityTitle, fieldLabel);
  if (typeError) {
    return [typeError];
  }

  const requiredError = validateTraceCodeRequiredValue(
    value,
    fieldDescriptor,
    entityTitle,
    fieldLabel
  );
  if (requiredError) {
    return [requiredError];
  }

  if (value === null || value === undefined || typeof value !== "string") {
    return [];
  }

  const formatError = validateTraceCodePattern(value, entityTitle, fieldLabel);
  if (formatError) {
    return [formatError];
  }

  const minLengthError = validateTraceCodeMinLength(
    value,
    fieldDescriptor,
    entityTitle,
    fieldLabel
  );
  if (minLengthError) {
    return [minLengthError];
  }

  const maxLengthError = validateTraceCodeMaxLength(
    value,
    fieldDescriptor,
    entityTitle,
    fieldLabel
  );
  if (maxLengthError) {
    return [maxLengthError];
  }

  return [];
}

function toDescriptorWithAnalysisBundleSchema(fieldDescriptor) {
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
      : cloneJsonValue(ANALYSIS_BUNDLE_DEFAULT_SCHEMA);
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

function normalizeAnalysisBundleDescriptorConstraints(rawField = {}, { strict = false } = {}) {
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
      : cloneJsonValue(ANALYSIS_BUNDLE_DEFAULT_SCHEMA);

  return {
    ok: true,
    descriptorPatch: {
      constraints: {
        objectSchema: normalizedSchema
      }
    }
  };
}

function normalizeAnalysisBundleDefaultValue(descriptor = {}, rawValue) {
  const descriptorWithSchema = toDescriptorWithAnalysisBundleSchema(descriptor);
  return normalizeStructuredObjectCollectionFieldDefaultValue(descriptorWithSchema, rawValue);
}

function normalizeAnalysisBundleInputValue(rawValue, { fieldDescriptor } = {}) {
  const descriptorWithSchema = toDescriptorWithAnalysisBundleSchema(fieldDescriptor);
  return normalizeStructuredObjectCollectionFieldInputValue(rawValue, {
    fieldDescriptor: descriptorWithSchema
  });
}

function normalizeAnalysisBundleStoredValue(rawValue, { explicitDefault = null, fieldDescriptor } = {}) {
  const descriptorWithSchema = toDescriptorWithAnalysisBundleSchema(fieldDescriptor);
  return normalizeStructuredObjectCollectionFieldStoredValue(rawValue, {
    explicitDefault,
    fieldDescriptor: descriptorWithSchema
  });
}

function defaultAnalysisBundleValue({ fieldDescriptor } = {}) {
  const descriptorWithSchema = toDescriptorWithAnalysisBundleSchema(fieldDescriptor);
  return defaultStructuredObjectCollectionFieldValue({
    fieldDescriptor: descriptorWithSchema
  });
}

function validateAnalysisBundleInputValue({ value, definition, fieldDescriptor } = {}) {
  const descriptorWithSchema = toDescriptorWithAnalysisBundleSchema(fieldDescriptor);
  return validateStructuredObjectCollectionFieldInputValue({
    value,
    definition,
    fieldDescriptor: descriptorWithSchema
  });
}

function summarizeAnalysisBundleCellValue({ value, fieldDescriptor } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "-";
  }

  if (
    typeof value.stage === "string" &&
    value.stage.length > 0 &&
    typeof value.confidence === "number" &&
    Number.isFinite(value.confidence)
  ) {
    return `${value.stage}:${value.confidence}`;
  }

  const schemaResult = resolveStructuredObjectSchemaFromDescriptor(
    toDescriptorWithAnalysisBundleSchema(fieldDescriptor),
    {
      strict: false
    }
  );

  return summarizeStructuredObjectValue(value, schemaResult.ok ? schemaResult.value : null);
}

const ITER5_TRACE_CODE_FIELD_TYPE_PLUGIN = Object.freeze({
  type: TRACE_CODE_FIELD_TYPE,
  schema: Object.freeze({
    kind: "text"
  }),
  normalizeDescriptorConstraints: normalizeTraceCodeDescriptorConstraints,
  normalizeDefaultValue: normalizeTraceCodeDefaultValue,
  runtime: Object.freeze({
    normalizeInputValue: normalizeTraceCodeInputValue,
    normalizeStoredValue: normalizeTraceCodeStoredValue,
    defaultValue: defaultTraceCodeValue,
    validateInputValue: validateTraceCodeInputValue
  }),
  frontend: Object.freeze({
    editor: Object.freeze({
      variant: "text-input",
      inputType: "text"
    }),
    cell: Object.freeze({
      variant: "text"
    })
  }),
  query: Object.freeze({
    supported: false,
    codeSuffix: "FILTER_UNSUPPORTED",
    message: "Trace code fields do not support filtering"
  })
});

const ITER5_ANALYSIS_BUNDLE_FIELD_TYPE_PLUGIN = Object.freeze({
  type: ANALYSIS_BUNDLE_FIELD_TYPE,
  schema: Object.freeze({
    kind: "json"
  }),
  normalizeDescriptorConstraints: normalizeAnalysisBundleDescriptorConstraints,
  normalizeDefaultValue: normalizeAnalysisBundleDefaultValue,
  runtime: Object.freeze({
    normalizeInputValue: normalizeAnalysisBundleInputValue,
    normalizeStoredValue: normalizeAnalysisBundleStoredValue,
    defaultValue: defaultAnalysisBundleValue,
    validateInputValue: validateAnalysisBundleInputValue
  }),
  frontend: Object.freeze({
    editor: Object.freeze({
      variant: "structured-object"
    }),
    cell: Object.freeze({
      variant: "structured-summary",
      summarizeValue: summarizeAnalysisBundleCellValue
    })
  }),
  query: Object.freeze({
    supported: false,
    codeSuffix: "FILTER_UNSUPPORTED",
    message: "Analysis bundle fields do not support filtering"
  })
});

const ITER5_FIELD_TYPE_PLUGINS = Object.freeze([
  ITER5_TRACE_CODE_FIELD_TYPE_PLUGIN,
  ITER5_ANALYSIS_BUNDLE_FIELD_TYPE_PLUGIN
]);

function registerCollectionFieldTypePlugins() {
  return ITER5_FIELD_TYPE_PLUGINS;
}

export {
  ITER5_ANALYSIS_BUNDLE_FIELD_TYPE_PLUGIN,
  ITER5_FIELD_TYPE_PLUGINS,
  ITER5_TRACE_CODE_FIELD_TYPE_PLUGIN,
  registerCollectionFieldTypePlugins
};
