import {
  createDiagnostic,
  isObject
} from "../shared.js";
import {
  valuesEqual
} from "../../../shared/capability-contracts/value-contract-utils.js";

function normalizeEnumOptions(moduleId, fieldId, rawOptions) {
  if (!Array.isArray(rawOptions) || rawOptions.length === 0) {
    return {
      ok: false,
      error: createDiagnostic(
        "MODULE_SETTINGS_SCHEMA_INVALID",
        `Module '${moduleId}' settings field '${fieldId}' enum options must be a non-empty array`,
        {
          moduleId,
          fieldId
        }
      )
    };
  }

  const options = [];
  const seenValues = new Set();
  for (const [optionIndex, rawOption] of rawOptions.entries()) {
    const optionValue =
      typeof rawOption === "string"
        ? rawOption.trim()
        : typeof rawOption?.value === "string"
          ? rawOption.value.trim()
          : "";
    const optionLabel =
      typeof rawOption === "object" &&
      rawOption !== null &&
      typeof rawOption.label === "string" &&
      rawOption.label.trim().length > 0
        ? rawOption.label
        : optionValue;

    if (optionValue.length === 0) {
      return {
        ok: false,
        error: createDiagnostic(
          "MODULE_SETTINGS_SCHEMA_INVALID",
          `Module '${moduleId}' settings field '${fieldId}' enum option at index ${optionIndex} is invalid`,
          {
            moduleId,
            fieldId
          }
        )
      };
    }

    if (seenValues.has(optionValue)) {
      return {
        ok: false,
        error: createDiagnostic(
          "MODULE_SETTINGS_SCHEMA_INVALID",
          `Module '${moduleId}' settings field '${fieldId}' enum option '${optionValue}' is duplicated`,
          {
            moduleId,
            fieldId
          }
        )
      };
    }

    seenValues.add(optionValue);
    options.push({
      value: optionValue,
      label: optionLabel
    });
  }

  return {
    ok: true,
    value: options
  };
}

function resolveFieldDefaultRaw(moduleId, fieldPath, fieldId, rawField) {
  const hasDefault = Object.prototype.hasOwnProperty.call(rawField, "default");
  const hasDefaultValue = Object.prototype.hasOwnProperty.call(rawField, "defaultValue");

  if (!hasDefault && !hasDefaultValue) {
    return {
      ok: true,
      hasDefault: false,
      value: undefined
    };
  }

  if (hasDefault && hasDefaultValue && !valuesEqual(rawField.default, rawField.defaultValue)) {
    return {
      ok: false,
      error: createDiagnostic(
        "MODULE_SETTINGS_SCHEMA_INVALID",
        `Module '${moduleId}' settings field '${fieldId}' default and defaultValue must match when both are provided`,
        {
          moduleId,
          field: `${fieldPath}.defaultValue`
        }
      )
    };
  }

  return {
    ok: true,
    hasDefault: true,
    value: hasDefaultValue ? rawField.defaultValue : rawField.default
  };
}

function normalizeObjectDefaultValue(
  moduleId,
  normalizedField,
  rawDefaultValue,
  normalizeDefaultValue
) {
  const nestedFields = Array.isArray(normalizedField.fields)
    ? normalizedField.fields
    : [];
  if (rawDefaultValue === null) {
    if (normalizedField.required === true) {
      return {
        ok: false,
        error: createDiagnostic(
          "MODULE_SETTINGS_SCHEMA_INVALID",
          `Module '${moduleId}' settings field '${normalizedField.id}' defaultValue cannot be null when field is required`,
          {
            moduleId,
            fieldId: normalizedField.id
          }
        )
      };
    }

    return {
      ok: true,
      value: null
    };
  }

  if (rawDefaultValue !== undefined && !isObject(rawDefaultValue)) {
    return {
      ok: false,
      error: createDiagnostic(
        "MODULE_SETTINGS_SCHEMA_INVALID",
        `Module '${moduleId}' settings field '${normalizedField.id}' defaultValue must be an object or null`,
        {
          moduleId,
          fieldId: normalizedField.id
        }
      )
    };
  }

  const nestedFieldMap = new Map(nestedFields.map((field) => [field.id, field]));
  if (isObject(rawDefaultValue)) {
    const unknownNestedField = Object.keys(rawDefaultValue).find(
      (fieldId) => !nestedFieldMap.has(fieldId)
    );
    if (unknownNestedField) {
      return {
        ok: false,
        error: createDiagnostic(
          "MODULE_SETTINGS_SCHEMA_INVALID",
          `Module '${moduleId}' settings field '${normalizedField.id}' defaultValue includes unsupported nested field '${unknownNestedField}'`,
          {
            moduleId,
            fieldId: `${normalizedField.id}.${unknownNestedField}`
          }
        )
      };
    }
  }

  const value = {};
  for (const nestedField of nestedFields) {
    const nestedRawDefault = isObject(rawDefaultValue)
      ? rawDefaultValue[nestedField.id]
      : undefined;
    const normalizedNestedDefault = normalizeDefaultValue(
      moduleId,
      nestedField,
      nestedRawDefault
    );
    if (!normalizedNestedDefault.ok) {
      return normalizedNestedDefault;
    }
    value[nestedField.id] = normalizedNestedDefault.value;
  }

  return {
    ok: true,
    value
  };
}

export {
  normalizeEnumOptions,
  normalizeObjectDefaultValue,
  resolveFieldDefaultRaw
};
