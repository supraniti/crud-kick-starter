import {
  valuesEqual
} from "../shared/capability-contracts/value-contract-utils.js";
import {
  resolveCollectionFieldTypePlugin
} from "../shared/capability-contracts/collection-field-type-plugin-registry.js";

function validationError(code, message, field) {
  return {
    code,
    message,
    field
  };
}

function createDefaultValueValidationError(message, fieldPath) {
  return {
    ok: false,
    error: validationError("MODULE_MANIFEST_INVALID", message, `${fieldPath}.defaultValue`)
  };
}

function resolveCollectionFieldDefaultRaw(field, fieldPath) {
  const hasDefault = Object.prototype.hasOwnProperty.call(field, "default");
  const hasDefaultValue = Object.prototype.hasOwnProperty.call(field, "defaultValue");

  if (!hasDefault && !hasDefaultValue) {
    return {
      ok: true,
      hasDefault: false,
      value: undefined
    };
  }

  if (hasDefault && hasDefaultValue && !valuesEqual(field.default, field.defaultValue)) {
    return createDefaultValueValidationError(
      "Collection field default and defaultValue must match when both are provided",
      fieldPath
    );
  }

  return {
    ok: true,
    hasDefault: true,
    value: hasDefaultValue ? field.defaultValue : field.default
  };
}

function normalizeNullCollectionDefaultValue(normalizedField, fieldLabel, fieldPath) {
  if (normalizedField.required === true) {
    return createDefaultValueValidationError(
      `Collection ${fieldLabel} field defaultValue cannot be null when field is required`,
      fieldPath
    );
  }

  return {
    ok: true,
    value: null
  };
}

function normalizeTextCollectionDefaultValue(normalizedField, rawValue, fieldPath) {
  if (typeof rawValue !== "string") {
    return createDefaultValueValidationError(
      "Collection text field defaultValue must be a string or null",
      fieldPath
    );
  }

  const normalized = rawValue.trim();
  if (normalizedField.required === true && normalized.length === 0) {
    return createDefaultValueValidationError(
      "Collection text field defaultValue cannot be empty when field is required",
      fieldPath
    );
  }

  if (Number.isInteger(normalizedField.minLength) && normalized.length < normalizedField.minLength) {
    return createDefaultValueValidationError(
      `Collection text field defaultValue must be at least ${normalizedField.minLength} characters`,
      fieldPath
    );
  }

  if (Number.isInteger(normalizedField.maxLength) && normalized.length > normalizedField.maxLength) {
    return createDefaultValueValidationError(
      `Collection text field defaultValue must be at most ${normalizedField.maxLength} characters`,
      fieldPath
    );
  }

  return {
    ok: true,
    value: normalized
  };
}

function normalizePluginCollectionDefaultValue(normalizedField, rawValue, fieldPath, fieldLabel) {
  const fieldTypePlugin = resolveCollectionFieldTypePlugin(normalizedField.type);
  if (!fieldTypePlugin || typeof fieldTypePlugin.normalizeDefaultValue !== "function") {
    return {
      ok: true,
      matched: false
    };
  }

  const normalizedDefault = fieldTypePlugin.normalizeDefaultValue(normalizedField, rawValue);
  if (!normalizedDefault || normalizedDefault.ok !== true) {
    const reason =
      typeof normalizedDefault?.reason === "string"
        ? normalizedDefault.reason
        : "defaultValue must be a string or null";

    return createDefaultValueValidationError(
      `Collection ${fieldLabel} field ${reason}`,
      fieldPath
    );
  }

  return {
    ok: true,
    matched: true,
    value: normalizedDefault.value
  };
}

function normalizeNumberCollectionDefaultValue(normalizedField, rawValue, fieldPath) {
  if (!Number.isFinite(rawValue)) {
    return createDefaultValueValidationError(
      "Collection number field defaultValue must be a finite number or null",
      fieldPath
    );
  }

  if (Number.isFinite(normalizedField.min) && rawValue < normalizedField.min) {
    return createDefaultValueValidationError(
      `Collection number field defaultValue must be >= ${normalizedField.min}`,
      fieldPath
    );
  }

  if (Number.isFinite(normalizedField.max) && rawValue > normalizedField.max) {
    return createDefaultValueValidationError(
      `Collection number field defaultValue must be <= ${normalizedField.max}`,
      fieldPath
    );
  }

  return {
    ok: true,
    value: rawValue
  };
}

function normalizeBooleanCollectionDefaultValue(rawValue, fieldPath) {
  if (typeof rawValue !== "boolean") {
    return createDefaultValueValidationError(
      "Collection boolean field defaultValue must be a boolean or null",
      fieldPath
    );
  }

  return {
    ok: true,
    value: rawValue
  };
}

function normalizeEnumCollectionDefaultValue(normalizedField, rawValue, fieldPath) {
  if (typeof rawValue !== "string") {
    return createDefaultValueValidationError(
      "Collection enum field defaultValue must be a string or null",
      fieldPath
    );
  }

  const normalized = rawValue.trim().toLowerCase();
  const optionSet = new Set(normalizedField.options ?? []);
  if (!optionSet.has(normalized)) {
    return createDefaultValueValidationError(
      `Collection enum field defaultValue '${normalized}' is not in options`,
      fieldPath
    );
  }

  return {
    ok: true,
    value: normalized
  };
}

function normalizeEnumMultiCollectionDefaultValue(normalizedField, rawValue, fieldPath) {
  if (!Array.isArray(rawValue)) {
    return createDefaultValueValidationError(
      "Collection enum-multi field defaultValue must be an array of strings or null",
      fieldPath
    );
  }

  const optionSet = new Set(normalizedField.options ?? []);
  const normalized = [];
  const seen = new Set();
  for (const [index, entry] of rawValue.entries()) {
    if (typeof entry !== "string") {
      return createDefaultValueValidationError(
        `Collection enum-multi field defaultValue[${index}] must be a string`,
        fieldPath
      );
    }

    const token = entry.trim().toLowerCase();
    if (!optionSet.has(token)) {
      return createDefaultValueValidationError(
        `Collection enum-multi field defaultValue '${token}' is not in options`,
        fieldPath
      );
    }

    if (!seen.has(token)) {
      seen.add(token);
      normalized.push(token);
    }
  }

  if (normalizedField.required === true && normalized.length === 0) {
    return createDefaultValueValidationError(
      "Collection enum-multi field defaultValue must include at least one value when field is required",
      fieldPath
    );
  }

  return {
    ok: true,
    value: normalized
  };
}

function normalizeReferenceCollectionDefaultValue(normalizedField, rawValue, fieldPath) {
  if (typeof rawValue !== "string") {
    return createDefaultValueValidationError(
      "Collection reference field defaultValue must be a string id or null",
      fieldPath
    );
  }

  const normalized = rawValue.trim();
  if (normalizedField.required === true && normalized.length === 0) {
    return createDefaultValueValidationError(
      "Collection reference field defaultValue cannot be empty when field is required",
      fieldPath
    );
  }

  return {
    ok: true,
    value: normalized.length > 0 ? normalized : null
  };
}

function normalizeReferenceMultiCollectionDefaultValue(normalizedField, rawValue, fieldPath) {
  if (!Array.isArray(rawValue)) {
    return createDefaultValueValidationError(
      "Collection reference-multi field defaultValue must be an array of string ids or null",
      fieldPath
    );
  }

  const normalized = [];
  const seen = new Set();
  for (const [index, entry] of rawValue.entries()) {
    if (typeof entry !== "string") {
      return createDefaultValueValidationError(
        `Collection reference-multi field defaultValue[${index}] must be a string`,
        fieldPath
      );
    }

    const token = entry.trim();
    if (token.length === 0 || seen.has(token)) {
      continue;
    }

    seen.add(token);
    normalized.push(token);
  }

  if (normalizedField.required === true && normalized.length === 0) {
    return createDefaultValueValidationError(
      "Collection reference-multi field defaultValue must include at least one id when field is required",
      fieldPath
    );
  }

  return {
    ok: true,
    value: normalized
  };
}

const COLLECTION_DEFAULT_NORMALIZERS = {
  number: normalizeNumberCollectionDefaultValue,
  boolean: (_field, rawValue, fieldPath) => normalizeBooleanCollectionDefaultValue(rawValue, fieldPath),
  enum: normalizeEnumCollectionDefaultValue,
  "enum-multi": normalizeEnumMultiCollectionDefaultValue,
  reference: normalizeReferenceCollectionDefaultValue,
  "reference-multi": normalizeReferenceMultiCollectionDefaultValue
};

function normalizeCollectionFieldDefaultValue(normalizedField, rawValue, fieldPath) {
  const fieldLabel = normalizedField.type;

  if (normalizedField.type === "computed") {
    return createDefaultValueValidationError(
      "Collection computed fields do not support defaultValue/default",
      fieldPath
    );
  }

  if (rawValue === null) {
    return normalizeNullCollectionDefaultValue(normalizedField, fieldLabel, fieldPath);
  }

  if (normalizedField.type === "text") {
    return normalizeTextCollectionDefaultValue(normalizedField, rawValue, fieldPath);
  }

  const pluginDefault = normalizePluginCollectionDefaultValue(
    normalizedField,
    rawValue,
    fieldPath,
    fieldLabel
  );
  if (!pluginDefault.ok) {
    return pluginDefault;
  }
  if (pluginDefault.matched) {
    return {
      ok: true,
      value: pluginDefault.value
    };
  }

  const normalizeDefaultValueForType = COLLECTION_DEFAULT_NORMALIZERS[normalizedField.type];
  if (typeof normalizeDefaultValueForType === "function") {
    return normalizeDefaultValueForType(normalizedField, rawValue, fieldPath);
  }

  return {
    ok: true,
    value: rawValue
  };
}

export {
  normalizeCollectionFieldDefaultValue,
  resolveCollectionFieldDefaultRaw
};
