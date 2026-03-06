import {
  createDiagnostic
} from "../shared.js";
import {
  isHttpUrlValue,
  isIsoDateString
} from "../../../../../../core/shared/capability-contracts/value-contract-utils.js";
import {
  normalizeObjectDefaultValue
} from "./01-default-object-and-enum-normalization.js";

function invalidSettingsDefault(moduleId, normalizedField, message) {
  return {
    ok: false,
    error: createDiagnostic("MODULE_SETTINGS_SCHEMA_INVALID", message, {
      moduleId,
      fieldId: normalizedField.id
    })
  };
}

function normalizeUndefinedDefaultValue(normalizedField) {
  if (normalizedField.type === "boolean") {
    return {
      ok: true,
      value: false
    };
  }

  if (normalizedField.type === "enum") {
    return {
      ok: true,
      value: normalizedField.options[0]?.value ?? null
    };
  }

  if (normalizedField.type === "enum-multi") {
    return {
      ok: true,
      value:
        normalizedField.required && normalizedField.options[0]?.value
          ? [normalizedField.options[0].value]
          : []
    };
  }

  return {
    ok: true,
    value: null
  };
}

function normalizeTextDefaultValue(moduleId, normalizedField, rawDefaultValue) {
  if (typeof rawDefaultValue !== "string") {
    return invalidSettingsDefault(
      moduleId,
      normalizedField,
      `Module '${moduleId}' settings field '${normalizedField.id}' defaultValue must be a string or null`
    );
  }

  return {
    ok: true,
    value: rawDefaultValue
  };
}

function normalizeUrlDefaultValue(moduleId, normalizedField, rawDefaultValue) {
  if (typeof rawDefaultValue !== "string") {
    return invalidSettingsDefault(
      moduleId,
      normalizedField,
      `Module '${moduleId}' settings field '${normalizedField.id}' defaultValue must be a string or null`
    );
  }

  const normalizedValue = rawDefaultValue.trim();
  if (normalizedField.required === true && normalizedValue.length === 0) {
    return invalidSettingsDefault(
      moduleId,
      normalizedField,
      `Module '${moduleId}' settings field '${normalizedField.id}' defaultValue cannot be empty when field is required`
    );
  }

  if (normalizedValue.length > 0 && !isHttpUrlValue(normalizedValue)) {
    return invalidSettingsDefault(
      moduleId,
      normalizedField,
      `Module '${moduleId}' settings field '${normalizedField.id}' defaultValue must be a valid http(s) URL`
    );
  }

  return {
    ok: true,
    value: normalizedValue
  };
}

function normalizeNumberDefaultValue(moduleId, normalizedField, rawDefaultValue) {
  if (typeof rawDefaultValue !== "number" || !Number.isFinite(rawDefaultValue)) {
    return invalidSettingsDefault(
      moduleId,
      normalizedField,
      `Module '${moduleId}' settings field '${normalizedField.id}' defaultValue must be a finite number or null`
    );
  }

  if (typeof normalizedField.min === "number" && rawDefaultValue < normalizedField.min) {
    return invalidSettingsDefault(
      moduleId,
      normalizedField,
      `Module '${moduleId}' settings field '${normalizedField.id}' defaultValue is below min`
    );
  }

  if (typeof normalizedField.max === "number" && rawDefaultValue > normalizedField.max) {
    return invalidSettingsDefault(
      moduleId,
      normalizedField,
      `Module '${moduleId}' settings field '${normalizedField.id}' defaultValue is above max`
    );
  }

  return {
    ok: true,
    value: rawDefaultValue
  };
}

function normalizeDateDefaultValue(moduleId, normalizedField, rawDefaultValue) {
  if (typeof rawDefaultValue !== "string") {
    return invalidSettingsDefault(
      moduleId,
      normalizedField,
      `Module '${moduleId}' settings field '${normalizedField.id}' defaultValue must be an ISO date string or null`
    );
  }

  const normalizedValue = rawDefaultValue.trim();
  if (normalizedField.required === true && normalizedValue.length === 0) {
    return invalidSettingsDefault(
      moduleId,
      normalizedField,
      `Module '${moduleId}' settings field '${normalizedField.id}' defaultValue cannot be empty when field is required`
    );
  }

  if (normalizedValue.length === 0) {
    return {
      ok: true,
      value: null
    };
  }

  if (!isIsoDateString(normalizedValue)) {
    return invalidSettingsDefault(
      moduleId,
      normalizedField,
      `Module '${moduleId}' settings field '${normalizedField.id}' defaultValue must match YYYY-MM-DD`
    );
  }

  return {
    ok: true,
    value: normalizedValue
  };
}

function normalizeBooleanDefaultValue(moduleId, normalizedField, rawDefaultValue) {
  if (typeof rawDefaultValue !== "boolean") {
    return invalidSettingsDefault(
      moduleId,
      normalizedField,
      `Module '${moduleId}' settings field '${normalizedField.id}' defaultValue must be a boolean or null`
    );
  }

  return {
    ok: true,
    value: rawDefaultValue
  };
}

function normalizeEnumDefaultValue(moduleId, normalizedField, rawDefaultValue) {
  if (typeof rawDefaultValue !== "string") {
    return invalidSettingsDefault(
      moduleId,
      normalizedField,
      `Module '${moduleId}' settings field '${normalizedField.id}' defaultValue must be a string or null`
    );
  }

  const optionValues = new Set(normalizedField.options.map((option) => option.value));
  if (!optionValues.has(rawDefaultValue)) {
    return invalidSettingsDefault(
      moduleId,
      normalizedField,
      `Module '${moduleId}' settings field '${normalizedField.id}' defaultValue '${rawDefaultValue}' is not in enum options`
    );
  }

  return {
    ok: true,
    value: rawDefaultValue
  };
}

function normalizeEnumMultiDefaultValue(moduleId, normalizedField, rawDefaultValue) {
  if (!Array.isArray(rawDefaultValue)) {
    return invalidSettingsDefault(
      moduleId,
      normalizedField,
      `Module '${moduleId}' settings field '${normalizedField.id}' defaultValue must be an array of enum values or null`
    );
  }

  const optionValues = new Set(normalizedField.options.map((option) => option.value));
  const normalizedValues = [];
  const seenValues = new Set();
  for (const [valueIndex, rawValue] of rawDefaultValue.entries()) {
    if (typeof rawValue !== "string") {
      return invalidSettingsDefault(
        moduleId,
        normalizedField,
        `Module '${moduleId}' settings field '${normalizedField.id}' defaultValue at index ${valueIndex} must be a string`
      );
    }

    if (!optionValues.has(rawValue)) {
      return invalidSettingsDefault(
        moduleId,
        normalizedField,
        `Module '${moduleId}' settings field '${normalizedField.id}' defaultValue '${rawValue}' is not in enum options`
      );
    }

    if (!seenValues.has(rawValue)) {
      seenValues.add(rawValue);
      normalizedValues.push(rawValue);
    }
  }

  if (normalizedField.required && normalizedValues.length === 0) {
    return invalidSettingsDefault(
      moduleId,
      normalizedField,
      `Module '${moduleId}' settings field '${normalizedField.id}' defaultValue must include at least one value when field is required`
    );
  }

  return {
    ok: true,
    value: normalizedValues
  };
}

const FIELD_DEFAULT_NORMALIZERS = {
  text: normalizeTextDefaultValue,
  url: normalizeUrlDefaultValue,
  number: normalizeNumberDefaultValue,
  date: normalizeDateDefaultValue,
  boolean: normalizeBooleanDefaultValue,
  enum: normalizeEnumDefaultValue,
  "enum-multi": normalizeEnumMultiDefaultValue
};

function normalizeDefaultValue(moduleId, normalizedField, rawDefaultValue) {
  if (normalizedField.type === "object") {
    return normalizeObjectDefaultValue(
      moduleId,
      normalizedField,
      rawDefaultValue,
      normalizeDefaultValue
    );
  }

  if (rawDefaultValue === undefined) {
    return normalizeUndefinedDefaultValue(normalizedField);
  }

  if (rawDefaultValue === null) {
    return {
      ok: true,
      value: null
    };
  }

  const normalizeFieldDefault = FIELD_DEFAULT_NORMALIZERS[normalizedField.type];
  if (typeof normalizeFieldDefault === "function") {
    return normalizeFieldDefault(moduleId, normalizedField, rawDefaultValue);
  }

  return {
    ok: true,
    value: null
  };
}

export { normalizeDefaultValue };
