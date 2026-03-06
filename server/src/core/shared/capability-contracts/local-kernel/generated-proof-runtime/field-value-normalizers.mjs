import {
  resolveCollectionFieldTypePlugin
} from "../collection-field-type-plugin-registry.mjs";

function normalizeTextValue(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

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

function normalizeEnumValue(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toLowerCase();
}

function normalizeOptionalDate(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    return "__INVALID__";
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed;
}

function normalizeNumberValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : "__INVALID__";
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    const parsed = Number.parseFloat(trimmed);
    if (!Number.isFinite(parsed)) {
      return "__INVALID__";
    }

    return parsed;
  }

  return "__INVALID__";
}

function normalizeBooleanValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
    return "__INVALID__";
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized.length === 0) {
      return null;
    }
    if (normalized === "true" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
    return "__INVALID__";
  }

  return "__INVALID__";
}

function clampNumberToDescriptorBounds(value, fieldDescriptor) {
  let next = value;
  if (typeof next !== "number" || !Number.isFinite(next)) {
    return next;
  }

  if (Number.isFinite(fieldDescriptor.min) && next < fieldDescriptor.min) {
    next = fieldDescriptor.min;
  }
  if (Number.isFinite(fieldDescriptor.max) && next > fieldDescriptor.max) {
    next = fieldDescriptor.max;
  }

  return next;
}

function normalizeReferenceId(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    return "__INVALID__";
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeReferenceIds(value) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    return "__INVALID__";
  }

  return normalizeStringSet(
    value.map((item) => (typeof item === "string" ? item.trim() : ""))
  );
}

function normalizeStringSet(values = []) {
  return [
    ...new Set(values.filter((value) => typeof value === "string" && value.length > 0))
  ];
}

function normalizeEnumMultiInput(value) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    return "__INVALID__";
  }

  return normalizeStringSet(
    value.map((item) => (typeof item === "string" ? item.trim().toLowerCase() : ""))
  );
}

function resolveCollectionFieldTypeRuntime(fieldDescriptor) {
  const fieldTypePlugin = resolveCollectionFieldTypePlugin(fieldDescriptor?.type);
  if (!fieldTypePlugin || typeof fieldTypePlugin !== "object") {
    return null;
  }

  if (!fieldTypePlugin.runtime || typeof fieldTypePlugin.runtime !== "object") {
    return null;
  }

  return fieldTypePlugin.runtime;
}

function normalizeFieldInputValue(fieldDescriptor, rawValue) {
  const fieldTypeRuntime = resolveCollectionFieldTypeRuntime(fieldDescriptor);
  if (typeof fieldTypeRuntime?.normalizeInputValue === "function") {
    return fieldTypeRuntime.normalizeInputValue(rawValue, {
      fieldDescriptor
    });
  }

  switch (fieldDescriptor.type) {
    case "text":
    case "url":
      return normalizeTextValue(rawValue);
    case "number":
      return normalizeNumberValue(rawValue);
    case "boolean":
      return normalizeBooleanValue(rawValue);
    case "enum":
      return normalizeEnumValue(rawValue);
    case "enum-multi":
      return normalizeEnumMultiInput(rawValue);
    case "reference":
      return normalizeReferenceId(rawValue);
    case "reference-multi":
      return normalizeReferenceIds(rawValue);
    default:
      return rawValue;
  }
}

function hasExplicitDefaultValue(fieldDescriptor) {
  return (
    fieldDescriptor &&
    typeof fieldDescriptor === "object" &&
    Object.prototype.hasOwnProperty.call(fieldDescriptor, "defaultValue")
  );
}

function cloneExplicitDefaultValue(fieldDescriptor) {
  if (!hasExplicitDefaultValue(fieldDescriptor)) {
    return undefined;
  }

  const value = fieldDescriptor.defaultValue;
  if (
    fieldDescriptor.type === "enum-multi" ||
    fieldDescriptor.type === "reference-multi"
  ) {
    return Array.isArray(value) ? [...value] : [];
  }
  if (value && typeof value === "object") {
    return cloneJsonValue(value);
  }
  return value;
}

function normalizeStoredTextLikeValue(rawValue, explicitDefault) {
  return typeof rawValue === "string" ? rawValue : explicitDefault ?? "";
}

function normalizeStoredNumberValue(fieldDescriptor, rawValue, explicitDefault) {
  const normalized = normalizeNumberValue(rawValue);
  if (normalized === "__INVALID__" || normalized === null) {
    if (explicitDefault !== undefined) {
      return explicitDefault;
    }
    return fieldDescriptor.required === true
      ? clampNumberToDescriptorBounds(0, fieldDescriptor)
      : null;
  }
  return clampNumberToDescriptorBounds(normalized, fieldDescriptor);
}

function normalizeStoredBooleanValue(fieldDescriptor, rawValue, explicitDefault) {
  const normalized = normalizeBooleanValue(rawValue);
  if (normalized === "__INVALID__" || normalized === null) {
    if (explicitDefault !== undefined) {
      return explicitDefault;
    }
    return fieldDescriptor.required === true ? false : null;
  }
  return normalized;
}

function normalizeStoredEnumValue(fieldDescriptor, rawValue, explicitDefault) {
  const normalized = normalizeEnumValue(rawValue);
  if (fieldDescriptor.optionSet?.size > 0 && fieldDescriptor.optionSet.has(normalized)) {
    return normalized;
  }
  if (explicitDefault !== undefined) {
    return explicitDefault;
  }
  return Array.isArray(fieldDescriptor.options) && fieldDescriptor.options.length > 0
    ? fieldDescriptor.options[0]
    : "";
}

function normalizeStoredEnumMultiValue(fieldDescriptor, rawValue, explicitDefault) {
  if (!Array.isArray(rawValue)) {
    return explicitDefault ?? [];
  }
  const normalized = normalizeStringSet(
    rawValue.map((item) => (typeof item === "string" ? item.trim().toLowerCase() : ""))
  );
  if (fieldDescriptor.optionSet?.size > 0) {
    return normalized.filter((value) => fieldDescriptor.optionSet.has(value));
  }
  return normalized;
}

function normalizeStoredReferenceValue(rawValue, explicitDefault) {
  const normalized = normalizeReferenceId(rawValue);
  if (normalized === "__INVALID__") {
    return explicitDefault ?? null;
  }
  return normalized;
}

function normalizeStoredReferenceMultiValue(rawValue, explicitDefault) {
  if (!Array.isArray(rawValue)) {
    return explicitDefault ?? [];
  }
  return normalizeStringSet(
    rawValue.map((item) => (typeof item === "string" ? item.trim() : ""))
  );
}

function normalizeFieldStoredValue(fieldDescriptor, rawValue) {
  const explicitDefault = cloneExplicitDefaultValue(fieldDescriptor);
  const fieldTypeRuntime = resolveCollectionFieldTypeRuntime(fieldDescriptor);
  if (typeof fieldTypeRuntime?.normalizeStoredValue === "function") {
    return fieldTypeRuntime.normalizeStoredValue(rawValue, {
      explicitDefault,
      fieldDescriptor
    });
  }

  switch (fieldDescriptor.type) {
    case "text":
    case "url":
      return normalizeStoredTextLikeValue(rawValue, explicitDefault);
    case "number":
      return normalizeStoredNumberValue(fieldDescriptor, rawValue, explicitDefault);
    case "boolean":
      return normalizeStoredBooleanValue(fieldDescriptor, rawValue, explicitDefault);
    case "enum":
      return normalizeStoredEnumValue(fieldDescriptor, rawValue, explicitDefault);
    case "enum-multi":
      return normalizeStoredEnumMultiValue(fieldDescriptor, rawValue, explicitDefault);
    case "reference":
      return normalizeStoredReferenceValue(rawValue, explicitDefault);
    case "reference-multi":
      return normalizeStoredReferenceMultiValue(rawValue, explicitDefault);
    default:
      return rawValue;
  }
}

function defaultFieldValue(fieldDescriptor) {
  const explicitDefault = cloneExplicitDefaultValue(fieldDescriptor);
  if (explicitDefault !== undefined) {
    return explicitDefault;
  }
  const fieldTypeRuntime = resolveCollectionFieldTypeRuntime(fieldDescriptor);
  if (typeof fieldTypeRuntime?.defaultValue === "function") {
    return fieldTypeRuntime.defaultValue({
      fieldDescriptor
    });
  }

  switch (fieldDescriptor.type) {
    case "text":
    case "url":
      return "";
    case "number":
      return fieldDescriptor.required === true
        ? clampNumberToDescriptorBounds(0, fieldDescriptor)
        : null;
    case "boolean":
      return fieldDescriptor.required === true ? false : null;
    case "enum":
      return Array.isArray(fieldDescriptor.options) && fieldDescriptor.options.length > 0
        ? fieldDescriptor.options[0]
        : "";
    case "enum-multi":
      return [];
    case "reference":
      return null;
    case "reference-multi":
      return [];
    default:
      return null;
  }
}

function cloneFieldValue(fieldDescriptor, value) {
  if (
    fieldDescriptor.type === "enum-multi" ||
    fieldDescriptor.type === "reference-multi"
  ) {
    return Array.isArray(value) ? [...value] : [];
  }
  if (value && typeof value === "object") {
    return cloneJsonValue(value);
  }
  return value;
}

function isIsoDateString(value) {
  if (typeof value !== "string") {
    return false;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export {
  clampNumberToDescriptorBounds,
  cloneFieldValue,
  defaultFieldValue,
  isIsoDateString,
  normalizeBooleanValue,
  normalizeEnumMultiInput,
  normalizeEnumValue,
  normalizeFieldInputValue,
  normalizeFieldStoredValue,
  normalizeNumberValue,
  normalizeOptionalDate,
  normalizeReferenceId,
  normalizeReferenceIds,
  normalizeStringSet,
  normalizeTextValue
};
