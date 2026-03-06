import {
  MODULE_SETTINGS_CONTRACT_VERSION,
  cloneValue,
  defaultValueForField,
  isObject,
  isValueAllowedForField,
  normalizeFieldValueForWrite,
  normalizeSettingsDefinition
} from "../../runtime-kernel/module-settings/normalization-helpers.js";

export function resolveModuleSettingsDefinitions(moduleRegistry) {
  const definitions = {};
  const diagnostics = [];

  for (const { manifest } of moduleRegistry.list()) {
    const normalized = normalizeSettingsDefinition(manifest);
    if (!normalized.ok) {
      diagnostics.push(normalized.error);
      continue;
    }
    if (!normalized.value) {
      continue;
    }
    definitions[manifest.id] = normalized.value;
  }

  return {
    definitions,
    diagnostics,
    moduleIds: Object.keys(definitions).sort()
  };
}

export function getModuleSettingsDefinition(definitions, moduleId) {
  return definitions?.[moduleId] ?? null;
}

export function createDefaultModuleSettings(definition) {
  const values = {};
  for (const field of definition?.fields ?? []) {
    values[field.id] = defaultValueForField(field);
  }
  return values;
}

export function normalizeModuleSettingsStateForRead(definition, storedValues = {}) {
  const normalized = {};
  for (const field of definition?.fields ?? []) {
    const rawValue = Object.prototype.hasOwnProperty.call(storedValues, field.id)
      ? storedValues[field.id]
      : undefined;
    if (rawValue === undefined) {
      normalized[field.id] = defaultValueForField(field);
      continue;
    }
    normalized[field.id] = isValueAllowedForField(field, rawValue)
      ? cloneValue(rawValue)
      : defaultValueForField(field);
  }
  return normalized;
}

function buildModuleSettingsSchemaFieldPayload(field) {
  const basePayload = {
    id: field.id,
    label: field.label,
    type: field.type,
    required: field.required === true,
    sensitive: field.sensitive === true,
    description: field.description ?? ""
  };

  if (field.type === "object") {
    return {
      ...basePayload,
      fields: Array.isArray(field.fields)
        ? field.fields.map((nestedField) => buildModuleSettingsSchemaFieldPayload(nestedField))
        : []
    };
  }

  return {
    ...basePayload,
    ...(Array.isArray(field.options)
      ? {
          options: field.options.map((option) => ({
            value: option.value,
            label: option.label
          }))
        }
      : {}),
    ...(typeof field.min === "number" ? { min: field.min } : {}),
    ...(typeof field.max === "number" ? { max: field.max } : {})
  };
}

export function buildModuleSettingsReadPayload(definition, values) {
  const redactedValues = {};
  const redactedFieldIds = [];
  for (const field of definition?.fields ?? []) {
    if (field.sensitive) {
      redactedValues[field.id] = null;
      redactedFieldIds.push(field.id);
      continue;
    }
    redactedValues[field.id] = cloneValue(values?.[field.id]);
  }

  return {
    schema: {
      contractVersion: MODULE_SETTINGS_CONTRACT_VERSION,
      fields: (definition?.fields ?? []).map((field) =>
        buildModuleSettingsSchemaFieldPayload(field)
      )
    },
    values: redactedValues,
    redactedFieldIds
  };
}

export function validateModuleSettingsPatch(definition, payload) {
  if (!isObject(payload)) {
    return {
      ok: false,
      errors: [
        {
          code: "MODULE_SETTINGS_PAYLOAD_INVALID",
          message: "Module settings payload must be an object"
        }
      ]
    };
  }

  const fieldMap = new Map((definition?.fields ?? []).map((field) => [field.id, field]));
  const unknownField = Object.keys(payload).find((fieldId) => !fieldMap.has(fieldId));
  if (unknownField) {
    return {
      ok: false,
      errors: [
        {
          code: "MODULE_SETTINGS_FIELD_UNKNOWN",
          message: `Setting '${unknownField}' is not supported`,
          fieldId: unknownField
        }
      ]
    };
  }

  const normalizedPatch = {};
  const errors = [];

  for (const [fieldId, rawValue] of Object.entries(payload)) {
    const field = fieldMap.get(fieldId);
    const normalizedValue = normalizeFieldValueForWrite(field, rawValue);
    if (!normalizedValue.ok) {
      errors.push(normalizedValue.error);
      continue;
    }
    normalizedPatch[fieldId] = normalizedValue.value;
  }

  return {
    ok: errors.length === 0,
    value: normalizedPatch,
    errors
  };
}

function mergeObjectSettingsFieldValues(field, currentValue, patchValue) {
  const nestedFields = Array.isArray(field?.fields) ? field.fields : [];
  const currentObject = isObject(currentValue) ? currentValue : {};
  const patchObject = isObject(patchValue) ? patchValue : {};
  const merged = {};

  for (const nestedField of nestedFields) {
    if (!nestedField || typeof nestedField.id !== "string" || nestedField.id.length === 0) {
      continue;
    }

    const hasPatchValue = Object.prototype.hasOwnProperty.call(patchObject, nestedField.id);
    const currentNestedValue = Object.prototype.hasOwnProperty.call(currentObject, nestedField.id)
      ? currentObject[nestedField.id]
      : defaultValueForField(nestedField);

    if (nestedField.type === "object") {
      const patchNestedValue = hasPatchValue
        ? patchObject[nestedField.id]
        : undefined;
      merged[nestedField.id] =
        hasPatchValue && patchNestedValue === null
          ? null
          : mergeObjectSettingsFieldValues(
              nestedField,
              currentNestedValue,
              patchNestedValue
            );
      continue;
    }

    merged[nestedField.id] = hasPatchValue
      ? cloneValue(patchObject[nestedField.id])
      : cloneValue(currentNestedValue);
  }

  return merged;
}

function mergeModuleSettingsFieldValue(field, currentValues, patchValues) {
  const hasCurrentValue = Object.prototype.hasOwnProperty.call(currentValues, field.id);
  const hasPatchValue = Object.prototype.hasOwnProperty.call(patchValues, field.id);
  const defaultFieldValue = defaultValueForField(field);
  const currentFieldValue = hasCurrentValue ? currentValues[field.id] : defaultFieldValue;

  if (field.type !== "object") {
    return hasPatchValue
      ? cloneValue(patchValues[field.id])
      : cloneValue(currentFieldValue);
  }

  if (hasPatchValue && patchValues[field.id] === null) {
    return null;
  }

  return mergeObjectSettingsFieldValues(
    field,
    currentFieldValue,
    hasPatchValue ? patchValues[field.id] : undefined
  );
}

function validateMergedModuleSettingsValues(definition, merged) {
  for (const field of definition?.fields ?? []) {
    const value = merged[field.id];
    if (field.required && (value === null || value === undefined)) {
      return {
        ok: false,
        error: {
          code: "MODULE_SETTINGS_FIELD_REQUIRED",
          message: `Setting '${field.id}' is required`,
          fieldId: field.id
        }
      };
    }

    if (!isValueAllowedForField(field, value)) {
      return {
        ok: false,
        error: {
          code: "MODULE_SETTINGS_FIELD_INVALID",
          message: `Setting '${field.id}' is invalid`,
          fieldId: field.id
        }
      };
    }
  }

  return {
    ok: true
  };
}

export function mergeModuleSettingsPatch(definition, currentValues, patchValues) {
  const current = isObject(currentValues) ? currentValues : {};
  const patch = isObject(patchValues) ? patchValues : {};
  const merged = {};

  for (const field of definition?.fields ?? []) {
    if (!field || typeof field.id !== "string" || field.id.length === 0) {
      continue;
    }

    merged[field.id] = mergeModuleSettingsFieldValue(field, current, patch);
  }

  const validation = validateMergedModuleSettingsValues(definition, merged);
  if (!validation.ok) {
    return validation;
  }

  return {
    ok: true,
    value: merged
  };
}

