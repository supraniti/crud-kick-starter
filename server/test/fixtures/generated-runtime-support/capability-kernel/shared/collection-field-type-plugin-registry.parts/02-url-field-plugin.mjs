import { isHttpUrlValue } from "../value-contract-utils.mjs";

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function normalizeUrlCollectionFieldConstraints(
  {
    minLength,
    maxLength
  } = {},
  { strict = false } = {}
) {
  const normalizedMinLength =
    minLength === undefined ? null : isNonNegativeInteger(minLength) ? minLength : null;
  const normalizedMaxLength =
    maxLength === undefined ? null : isNonNegativeInteger(maxLength) ? maxLength : null;

  if (strict && minLength !== undefined && normalizedMinLength === null) {
    return {
      ok: false,
      reason: "minLength must be an integer >= 0 when provided"
    };
  }

  if (strict && maxLength !== undefined && normalizedMaxLength === null) {
    return {
      ok: false,
      reason: "maxLength must be an integer >= 0 when provided"
    };
  }

  if (
    Number.isInteger(normalizedMinLength) &&
    Number.isInteger(normalizedMaxLength) &&
    normalizedMaxLength < normalizedMinLength
  ) {
    if (strict) {
      return {
        ok: false,
        reason: "maxLength must be greater than or equal to minLength"
      };
    }

    return {
      ok: true,
      minLength: normalizedMaxLength,
      maxLength: normalizedMinLength
    };
  }

  return {
    ok: true,
    minLength: normalizedMinLength,
    maxLength: normalizedMaxLength
  };
}

function normalizeUrlCollectionFieldDefaultValue(
  {
    required = false,
    minLength = null,
    maxLength = null
  } = {},
  rawValue
) {
  if (rawValue === null) {
    if (required === true) {
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

  if (typeof rawValue !== "string") {
    return {
      ok: false,
      reason: "defaultValue must be a string or null"
    };
  }

  const normalized = rawValue.trim();
  if (required === true && normalized.length === 0) {
    return {
      ok: false,
      reason: "defaultValue cannot be empty when field is required"
    };
  }
  if (Number.isInteger(minLength) && normalized.length < minLength) {
    return {
      ok: false,
      reason: `defaultValue must be at least ${minLength} characters`
    };
  }
  if (Number.isInteger(maxLength) && normalized.length > maxLength) {
    return {
      ok: false,
      reason: `defaultValue must be at most ${maxLength} characters`
    };
  }
  if (normalized.length > 0 && !isHttpUrlValue(normalized)) {
    return {
      ok: false,
      reason: "defaultValue must be a valid http(s) URL"
    };
  }

  return {
    ok: true,
    value: normalized
  };
}

function normalizeUrlCollectionFieldInputValue(rawValue) {
  if (typeof rawValue !== "string") {
    return "";
  }

  return rawValue.trim();
}

function normalizeUrlCollectionFieldStoredValue(
  rawValue,
  {
    explicitDefault = ""
  } = {}
) {
  if (typeof rawValue === "string") {
    return rawValue;
  }

  return explicitDefault ?? "";
}

function defaultUrlCollectionFieldValue() {
  return "";
}

function validateUrlCollectionFieldInputValue(
  {
    value,
    definition,
    fieldDescriptor
  } = {}
) {
  const entityTitle =
    typeof definition?.entityTitle === "string" && definition.entityTitle.length > 0
      ? definition.entityTitle
      : "Item";
  const fieldLabel =
    typeof fieldDescriptor?.id === "string" && fieldDescriptor.id.length > 0
      ? fieldDescriptor.id
      : "field";

  if (typeof value === "string" && value.length > 0 && !isHttpUrlValue(value)) {
    return [
      {
        codeSuffix: "INVALID_URL",
        message: `${entityTitle} ${fieldLabel} must be a valid http(s) URL`
      }
    ];
  }

  return [];
}

const URL_COLLECTION_FIELD_TYPE_PLUGIN = Object.freeze({
  type: "url",
  schema: Object.freeze({
    kind: "text"
  }),
  normalizeDescriptorConstraints: normalizeUrlCollectionFieldConstraints,
  normalizeDefaultValue: normalizeUrlCollectionFieldDefaultValue,
  runtime: Object.freeze({
    normalizeInputValue: normalizeUrlCollectionFieldInputValue,
    normalizeStoredValue: normalizeUrlCollectionFieldStoredValue,
    defaultValue: defaultUrlCollectionFieldValue,
    validateInputValue: validateUrlCollectionFieldInputValue
  }),
  frontend: Object.freeze({
    editor: Object.freeze({
      variant: "text-input",
      inputType: "url",
      fullWidth: true
    }),
    cell: Object.freeze({
      variant: "url-link"
    })
  })
});

export {
  URL_COLLECTION_FIELD_TYPE_PLUGIN,
  defaultUrlCollectionFieldValue,
  normalizeUrlCollectionFieldConstraints,
  normalizeUrlCollectionFieldDefaultValue,
  normalizeUrlCollectionFieldInputValue,
  normalizeUrlCollectionFieldStoredValue,
  validateUrlCollectionFieldInputValue
};
