import { cloneValue } from "../../runtime-kernel/module-settings/schema-normalization.js";
import {
  isHttpUrlValue,
  isIsoDateString
} from "../../../../core/shared/capability-contracts/value-contract-utils.js";

function defaultValueForField(field) {
  if (field.defaultValue !== undefined) {
    return cloneValue(field.defaultValue);
  }
  if (field.type === "boolean") {
    return false;
  }
  if (field.type === "enum") {
    return field.options?.[0]?.value ?? null;
  }
  if (field.type === "enum-multi") {
    return field.required === true && field.options?.[0]?.value
      ? [field.options[0].value]
      : [];
  }
  if (field.type === "object") {
    const value = {};
    for (const nestedField of field.fields ?? []) {
      value[nestedField.id] = defaultValueForField(nestedField);
    }
    return value;
  }
  return null;
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function isValueAllowedForObjectField(field, value) {
  if (!isPlainObject(value)) {
    return false;
  }

  const nestedFields = Array.isArray(field.fields) ? field.fields : [];
  const nestedFieldMap = new Map(nestedFields.map((nestedField) => [nestedField.id, nestedField]));
  for (const nestedFieldId of Object.keys(value)) {
    if (!nestedFieldMap.has(nestedFieldId)) {
      return false;
    }
  }

  for (const nestedField of nestedFields) {
    const nestedValue = Object.prototype.hasOwnProperty.call(value, nestedField.id)
      ? value[nestedField.id]
      : null;
    if (!isValueAllowedForField(nestedField, nestedValue)) {
      return false;
    }
  }

  return true;
}

function isValueAllowedForUrlField(field, value) {
  if (typeof value !== "string") {
    return false;
  }

  const normalizedValue = value.trim();
  if (field.required === true && normalizedValue.length === 0) {
    return false;
  }

  if (normalizedValue.length > 0 && !isHttpUrlValue(normalizedValue)) {
    return false;
  }

  return true;
}

function isValueAllowedForNumberField(field, value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return false;
  }
  if (typeof field.min === "number" && value < field.min) {
    return false;
  }
  if (typeof field.max === "number" && value > field.max) {
    return false;
  }
  return true;
}

function isValueAllowedForEnumMultiField(field, value) {
  if (!Array.isArray(value)) {
    return false;
  }
  if (field.required && value.length === 0) {
    return false;
  }

  const optionValues = new Set((field.options ?? []).map((option) => option.value));
  const seenValues = new Set();
  for (const item of value) {
    if (typeof item !== "string") {
      return false;
    }
    if (!optionValues.has(item) || seenValues.has(item)) {
      return false;
    }
    seenValues.add(item);
  }

  return true;
}

const ALLOWED_FIELD_VALUE_VALIDATORS = {
  text: (_field, value) => typeof value === "string",
  url: isValueAllowedForUrlField,
  number: isValueAllowedForNumberField,
  date: (_field, value) => typeof value === "string" && isIsoDateString(value.trim()),
  boolean: (_field, value) => typeof value === "boolean",
  enum: (field, value) =>
    typeof value === "string" && (field.options ?? []).some((option) => option.value === value),
  "enum-multi": isValueAllowedForEnumMultiField,
  object: isValueAllowedForObjectField
};

function isValueAllowedForField(field, value) {
  if (value === null) {
    return !field.required;
  }

  const validator = ALLOWED_FIELD_VALUE_VALIDATORS[field.type];
  if (typeof validator !== "function") {
    return false;
  }

  return validator(field, value);
}

function createFieldNormalizationError(field, code, message, fieldId = field.id) {
  return {
    ok: false,
    error: {
      code,
      message,
      fieldId
    }
  };
}

function listEnumOptionValues(field) {
  return (field.options ?? []).map((option) => option.value).join(", ");
}

function normalizeNullFieldValue(field) {
  if (field.required) {
    return createFieldNormalizationError(
      field,
      "MODULE_SETTINGS_FIELD_REQUIRED",
      `Setting '${field.id}' is required`
    );
  }

  return {
    ok: true,
    value: null
  };
}

function normalizeTextFieldValue(field, rawValue) {
  if (typeof rawValue !== "string") {
    return createFieldNormalizationError(
      field,
      "MODULE_SETTINGS_FIELD_INVALID",
      `Setting '${field.id}' must be a string`
    );
  }

  return {
    ok: true,
    value: rawValue
  };
}

function normalizeUrlFieldValue(field, rawValue) {
  if (typeof rawValue !== "string") {
    return createFieldNormalizationError(
      field,
      "MODULE_SETTINGS_FIELD_INVALID",
      `Setting '${field.id}' must be a string`
    );
  }

  const normalizedValue = rawValue.trim();
  if (field.required === true && normalizedValue.length === 0) {
    return createFieldNormalizationError(
      field,
      "MODULE_SETTINGS_FIELD_REQUIRED",
      `Setting '${field.id}' is required`
    );
  }

  if (normalizedValue.length > 0 && !isHttpUrlValue(normalizedValue)) {
    return createFieldNormalizationError(
      field,
      "MODULE_SETTINGS_FIELD_INVALID",
      `Setting '${field.id}' must be a valid http(s) URL`
    );
  }

  return {
    ok: true,
    value: normalizedValue
  };
}

function normalizeNumberFieldValue(field, rawValue) {
  const parsed =
    typeof rawValue === "string" && rawValue.trim().length > 0
      ? Number.parseFloat(rawValue)
      : rawValue;

  if (typeof parsed !== "number" || !Number.isFinite(parsed)) {
    return createFieldNormalizationError(
      field,
      "MODULE_SETTINGS_FIELD_INVALID",
      `Setting '${field.id}' must be a finite number`
    );
  }

  if (typeof field.min === "number" && parsed < field.min) {
    return createFieldNormalizationError(
      field,
      "MODULE_SETTINGS_FIELD_RANGE_INVALID",
      `Setting '${field.id}' must be >= ${field.min}`
    );
  }

  if (typeof field.max === "number" && parsed > field.max) {
    return createFieldNormalizationError(
      field,
      "MODULE_SETTINGS_FIELD_RANGE_INVALID",
      `Setting '${field.id}' must be <= ${field.max}`
    );
  }

  return {
    ok: true,
    value: parsed
  };
}

function normalizeDateFieldValue(field, rawValue) {
  if (typeof rawValue !== "string") {
    return createFieldNormalizationError(
      field,
      "MODULE_SETTINGS_FIELD_INVALID",
      `Setting '${field.id}' must be an ISO date string`
    );
  }

  const normalizedValue = rawValue.trim();
  if (normalizedValue.length === 0) {
    if (field.required === true) {
      return createFieldNormalizationError(
        field,
        "MODULE_SETTINGS_FIELD_REQUIRED",
        `Setting '${field.id}' is required`
      );
    }

    return {
      ok: true,
      value: null
    };
  }

  if (!isIsoDateString(normalizedValue)) {
    return createFieldNormalizationError(
      field,
      "MODULE_SETTINGS_FIELD_INVALID",
      `Setting '${field.id}' must match YYYY-MM-DD`
    );
  }

  return {
    ok: true,
    value: normalizedValue
  };
}

function normalizeBooleanFieldValue(field, rawValue) {
  if (typeof rawValue !== "boolean") {
    return createFieldNormalizationError(
      field,
      "MODULE_SETTINGS_FIELD_INVALID",
      `Setting '${field.id}' must be a boolean`
    );
  }

  return {
    ok: true,
    value: rawValue
  };
}

function normalizeEnumFieldValue(field, rawValue) {
  if (typeof rawValue !== "string") {
    return createFieldNormalizationError(
      field,
      "MODULE_SETTINGS_FIELD_INVALID",
      `Setting '${field.id}' must be a string enum value`
    );
  }

  const optionValues = new Set((field.options ?? []).map((option) => option.value));
  if (!optionValues.has(rawValue)) {
    return createFieldNormalizationError(
      field,
      "MODULE_SETTINGS_FIELD_INVALID",
      `Setting '${field.id}' must be one of: ${listEnumOptionValues(field)}`
    );
  }

  return {
    ok: true,
    value: rawValue
  };
}

function normalizeEnumMultiFieldValue(field, rawValue) {
  if (!Array.isArray(rawValue)) {
    return createFieldNormalizationError(
      field,
      "MODULE_SETTINGS_FIELD_INVALID",
      `Setting '${field.id}' must be an array of enum values`
    );
  }

  const optionValues = new Set((field.options ?? []).map((option) => option.value));
  const normalizedValues = [];
  const seenValues = new Set();
  for (const [index, item] of rawValue.entries()) {
    if (typeof item !== "string") {
      return createFieldNormalizationError(
        field,
        "MODULE_SETTINGS_FIELD_INVALID",
        `Setting '${field.id}' value at index ${index} must be a string`
      );
    }

    if (!optionValues.has(item)) {
      return createFieldNormalizationError(
        field,
        "MODULE_SETTINGS_FIELD_INVALID",
        `Setting '${field.id}' must be one of: ${listEnumOptionValues(field)}`
      );
    }

    if (!seenValues.has(item)) {
      seenValues.add(item);
      normalizedValues.push(item);
    }
  }

  if (field.required && normalizedValues.length === 0) {
    return createFieldNormalizationError(
      field,
      "MODULE_SETTINGS_FIELD_REQUIRED",
      `Setting '${field.id}' requires at least one value`
    );
  }

  return {
    ok: true,
    value: normalizedValues
  };
}

function normalizeObjectFieldValue(field, rawValue) {
  if (!isPlainObject(rawValue)) {
    return createFieldNormalizationError(
      field,
      "MODULE_SETTINGS_FIELD_INVALID",
      `Setting '${field.id}' must be an object`
    );
  }

  const nestedFields = Array.isArray(field.fields) ? field.fields : [];
  const nestedFieldMap = new Map(nestedFields.map((nestedField) => [nestedField.id, nestedField]));
  const unknownNestedField = Object.keys(rawValue).find(
    (nestedFieldId) => !nestedFieldMap.has(nestedFieldId)
  );
  if (unknownNestedField) {
    return createFieldNormalizationError(
      field,
      "MODULE_SETTINGS_FIELD_INVALID",
      `Setting '${field.id}.${unknownNestedField}' is not supported`,
      `${field.id}.${unknownNestedField}`
    );
  }

  const normalizedValue = {};
  for (const nestedField of nestedFields) {
    const nestedRawValue = Object.prototype.hasOwnProperty.call(rawValue, nestedField.id)
      ? rawValue[nestedField.id]
      : null;
    const normalizedNestedValue = normalizeFieldValueForWrite(nestedField, nestedRawValue);
    if (!normalizedNestedValue.ok) {
      return normalizedNestedValue;
    }
    normalizedValue[nestedField.id] = normalizedNestedValue.value;
  }

  return {
    ok: true,
    value: normalizedValue
  };
}

const FIELD_WRITE_NORMALIZERS = {
  text: normalizeTextFieldValue,
  url: normalizeUrlFieldValue,
  number: normalizeNumberFieldValue,
  date: normalizeDateFieldValue,
  boolean: normalizeBooleanFieldValue,
  enum: normalizeEnumFieldValue,
  "enum-multi": normalizeEnumMultiFieldValue,
  object: normalizeObjectFieldValue
};

function normalizeFieldValueForWrite(field, rawValue) {
  if (rawValue === null) {
    return normalizeNullFieldValue(field);
  }

  const normalizeFieldValue = FIELD_WRITE_NORMALIZERS[field.type];
  if (typeof normalizeFieldValue !== "function") {
    return createFieldNormalizationError(
      field,
      "MODULE_SETTINGS_FIELD_INVALID",
      `Setting '${field.id}' has unsupported type`
    );
  }

  return normalizeFieldValue(field, rawValue);
}

export {
  defaultValueForField,
  isValueAllowedForField,
  normalizeFieldValueForWrite
};
