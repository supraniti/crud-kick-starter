import { isIsoDateString } from "../value-contract-utils.mjs";

function normalizeDateCollectionFieldDefaultValue(
  {
    required = false
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
      reason: "defaultValue must be an ISO date string or null"
    };
  }

  const normalized = rawValue.trim();
  if (!isIsoDateString(normalized)) {
    return {
      ok: false,
      reason: "defaultValue must match YYYY-MM-DD"
    };
  }

  return {
    ok: true,
    value: normalized
  };
}

function normalizeDateCollectionFieldInputValue(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }
  if (typeof rawValue !== "string") {
    return "__INVALID__";
  }

  const trimmed = rawValue.trim();
  if (trimmed.length === 0) {
    return null;
  }

  return trimmed;
}

function normalizeDateCollectionFieldStoredValue(
  rawValue,
  {
    explicitDefault = null
  } = {}
) {
  const normalized = normalizeDateCollectionFieldInputValue(rawValue);
  if (normalized === "__INVALID__") {
    return explicitDefault;
  }

  return normalized;
}

function defaultDateCollectionFieldValue() {
  return null;
}

function validateDateCollectionFieldInputValue(
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
  if (value === "__INVALID__" || (value !== null && !isIsoDateString(value))) {
    return [
      {
        codeSuffix: "INVALID",
        message: `${entityTitle} ${fieldLabel} must be null or an ISO date (YYYY-MM-DD)`
      }
    ];
  }

  if (fieldDescriptor?.required === true && value === null) {
    return [
      {
        codeSuffix: "REQUIRED",
        message: `${entityTitle} ${fieldLabel} is required`
      }
    ];
  }

  return [];
}

const DATE_COLLECTION_FIELD_TYPE_PLUGIN = Object.freeze({
  type: "date",
  schema: Object.freeze({
    kind: "text"
  }),
  normalizeDefaultValue: normalizeDateCollectionFieldDefaultValue,
  runtime: Object.freeze({
    normalizeInputValue: normalizeDateCollectionFieldInputValue,
    normalizeStoredValue: normalizeDateCollectionFieldStoredValue,
    defaultValue: defaultDateCollectionFieldValue,
    validateInputValue: validateDateCollectionFieldInputValue
  }),
  frontend: Object.freeze({
    editor: Object.freeze({
      variant: "text-input",
      inputType: "date",
      inputLabelShrink: true
    }),
    cell: Object.freeze({
      variant: "date-text"
    })
  })
});

export {
  DATE_COLLECTION_FIELD_TYPE_PLUGIN,
  defaultDateCollectionFieldValue,
  normalizeDateCollectionFieldDefaultValue,
  normalizeDateCollectionFieldInputValue,
  normalizeDateCollectionFieldStoredValue,
  validateDateCollectionFieldInputValue
};
