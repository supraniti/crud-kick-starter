function cloneRuntimeModule(item) {
  return {
    ...item,
    capabilities: [...(item.capabilities ?? [])],
    collectionIds: [...(item.collectionIds ?? [])],
    ui: item.ui ? { ...item.ui, navigation: { ...(item.ui.navigation ?? {}) } } : {}
  };
}

function findRuntimeModule(state, moduleId) {
  return state.moduleRuntime.find((item) => item.id === moduleId) ?? null;
}

function lifecycleErrorResponse(state, action, moduleId, code, message, beforeState = null) {
  return {
    ok: false,
    action,
    moduleId,
    state: {
      before: beforeState,
      after: findRuntimeModule(state, moduleId)?.state ?? beforeState
    },
    error: {
      code,
      message
    }
  };
}

function lifecycleSuccessResponse(action, moduleId, beforeState, afterState) {
  return {
    ok: true,
    action,
    moduleId,
    state: {
      before: beforeState,
      after: afterState
    }
  };
}

function resolveModuleSettingsDefinition(state, moduleId) {
  return state.moduleSettingsDefinitions?.[moduleId] ?? null;
}

function isModuleSettingsStateReady(moduleState) {
  return moduleState === "installed" || moduleState === "enabled" || moduleState === "disabled";
}

function isHttpUrlValue(value) {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isIsoDateString(value) {
  if (typeof value !== "string") {
    return false;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value
    .split("-")
    .map((part) => Number.parseInt(part, 10));
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function cloneSettingsField(field) {
  return {
    id: field.id,
    label: field.label,
    type: field.type,
    required: field.required === true,
    sensitive: field.sensitive === true,
    description: field.description ?? "",
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

function defaultSettingValue(field) {
  if (field.defaultValue !== undefined) {
    return field.defaultValue;
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
  return null;
}

function normalizeModuleSettingsValues(definition, values) {
  const normalized = {};
  for (const field of definition?.fields ?? []) {
    if (values && Object.prototype.hasOwnProperty.call(values, field.id)) {
      normalized[field.id] = values[field.id];
      continue;
    }
    normalized[field.id] = defaultSettingValue(field);
  }
  return normalized;
}

function buildModuleSettingsReadPayload(definition, values) {
  const normalizedValues = normalizeModuleSettingsValues(definition, values);
  const readValues = {};
  const redactedFieldIds = [];

  for (const field of definition?.fields ?? []) {
    if (field.sensitive) {
      readValues[field.id] = null;
      redactedFieldIds.push(field.id);
      continue;
    }
    readValues[field.id] = normalizedValues[field.id];
  }

  return {
    schema: {
      contractVersion: 1,
      fields: (definition?.fields ?? []).map((field) => cloneSettingsField(field))
    },
    values: readValues,
    redactedFieldIds
  };
}

function settingsFieldError(field, code, message) {
  return {
    ok: false,
    error: {
      code,
      message,
      fieldId: field.id
    }
  };
}

function settingsFieldInvalid(field, expectedMessage) {
  return settingsFieldError(
    field,
    "MODULE_SETTINGS_FIELD_INVALID",
    `Setting '${field.id}' ${expectedMessage}`
  );
}

function settingsFieldRequired(field) {
  return settingsFieldError(
    field,
    "MODULE_SETTINGS_FIELD_REQUIRED",
    `Setting '${field.id}' is required`
  );
}

function settingsFieldOptionValues(field) {
  return (field.options ?? []).map((option) => option.value);
}

function settingsFieldOneOfMessage(field) {
  return `must be one of: ${settingsFieldOptionValues(field).join(", ")}`;
}

function settingsFieldOptionSet(field) {
  return new Set(settingsFieldOptionValues(field));
}

function parseNumberFieldValue(rawValue) {
  if (typeof rawValue === "string" && rawValue.trim().length > 0) {
    return Number.parseFloat(rawValue);
  }

  return rawValue;
}

function normalizeTextSettingsPatchField(field, rawValue) {
  if (typeof rawValue !== "string") {
    return settingsFieldInvalid(field, "must be a string");
  }

  return {
    ok: true,
    value: rawValue
  };
}

function normalizeUrlSettingsPatchField(field, rawValue) {
  if (typeof rawValue !== "string") {
    return settingsFieldInvalid(field, "must be a string");
  }

  const normalizedValue = rawValue.trim();
  if (field.required === true && normalizedValue.length === 0) {
    return settingsFieldRequired(field);
  }
  if (normalizedValue.length > 0 && !isHttpUrlValue(normalizedValue)) {
    return settingsFieldInvalid(field, "must be a valid http(s) URL");
  }

  return {
    ok: true,
    value: normalizedValue
  };
}

function normalizeNumberSettingsPatchField(field, rawValue) {
  const parsed = parseNumberFieldValue(rawValue);
  if (typeof parsed !== "number" || !Number.isFinite(parsed)) {
    return settingsFieldInvalid(field, "must be a finite number");
  }
  if (typeof field.min === "number" && parsed < field.min) {
    return settingsFieldError(
      field,
      "MODULE_SETTINGS_FIELD_RANGE_INVALID",
      `Setting '${field.id}' must be >= ${field.min}`
    );
  }
  if (typeof field.max === "number" && parsed > field.max) {
    return settingsFieldError(
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

function normalizeDateSettingsPatchField(field, rawValue) {
  if (typeof rawValue !== "string") {
    return settingsFieldInvalid(field, "must be an ISO date string");
  }

  const normalizedValue = rawValue.trim();
  if (normalizedValue.length === 0) {
    return field.required === true
      ? settingsFieldRequired(field)
      : {
          ok: true,
          value: null
        };
  }

  if (!isIsoDateString(normalizedValue)) {
    return settingsFieldInvalid(field, "must match YYYY-MM-DD");
  }

  return {
    ok: true,
    value: normalizedValue
  };
}

function normalizeBooleanSettingsPatchField(field, rawValue) {
  if (typeof rawValue !== "boolean") {
    return settingsFieldInvalid(field, "must be a boolean");
  }

  return {
    ok: true,
    value: rawValue
  };
}

function normalizeEnumSettingsPatchField(field, rawValue) {
  if (typeof rawValue !== "string") {
    return settingsFieldInvalid(field, "must be a string enum value");
  }

  const optionValues = settingsFieldOptionSet(field);
  if (!optionValues.has(rawValue)) {
    return settingsFieldInvalid(field, settingsFieldOneOfMessage(field));
  }

  return {
    ok: true,
    value: rawValue
  };
}

function normalizeEnumMultiSettingsPatchField(field, rawValue) {
  if (!Array.isArray(rawValue)) {
    return settingsFieldInvalid(field, "must be an array of enum values");
  }

  const optionValues = settingsFieldOptionSet(field);
  const normalizedValues = [];
  const seenValues = new Set();
  for (const [index, item] of rawValue.entries()) {
    if (typeof item !== "string") {
      return settingsFieldInvalid(field, `value at index ${index} must be a string`);
    }

    if (!optionValues.has(item)) {
      return settingsFieldInvalid(field, settingsFieldOneOfMessage(field));
    }

    if (seenValues.has(item)) {
      continue;
    }

    seenValues.add(item);
    normalizedValues.push(item);
  }

  if (field.required && normalizedValues.length === 0) {
    return settingsFieldError(
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

const SETTINGS_PATCH_FIELD_NORMALIZERS = Object.freeze({
  text: normalizeTextSettingsPatchField,
  url: normalizeUrlSettingsPatchField,
  number: normalizeNumberSettingsPatchField,
  date: normalizeDateSettingsPatchField,
  boolean: normalizeBooleanSettingsPatchField,
  enum: normalizeEnumSettingsPatchField,
  "enum-multi": normalizeEnumMultiSettingsPatchField
});

function normalizeSettingsPatchField(field, rawValue) {
  if (rawValue === null) {
    return field.required
      ? settingsFieldRequired(field)
      : {
          ok: true,
          value: null
        };
  }

  const normalize = SETTINGS_PATCH_FIELD_NORMALIZERS[field.type];
  if (typeof normalize !== "function") {
    return settingsFieldInvalid(field, "has unsupported type");
  }

  return normalize(field, rawValue);
}

function validateSettingsPatch(definition, payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      ok: false,
      error: {
        code: "MODULE_SETTINGS_PAYLOAD_INVALID",
        message: "Module settings payload must be an object"
      }
    };
  }

  const fieldMap = new Map((definition?.fields ?? []).map((field) => [field.id, field]));
  const unknownField = Object.keys(payload).find((fieldId) => !fieldMap.has(fieldId));
  if (unknownField) {
    return {
      ok: false,
      error: {
        code: "MODULE_SETTINGS_FIELD_UNKNOWN",
        message: `Setting '${unknownField}' is not supported`,
        fieldId: unknownField
      }
    };
  }

  const patch = {};
  for (const [fieldId, rawValue] of Object.entries(payload)) {
    const field = fieldMap.get(fieldId);
    const normalized = normalizeSettingsPatchField(field, rawValue);
    if (!normalized.ok) {
      return normalized;
    }
    patch[fieldId] = normalized.value;
  }

  return {
    ok: true,
    patch
  };
}

function createReferenceStatePolicyDescriptor() {
  return {
    configuredMode: "memory",
    runtimeMode: "memory",
    source: "reference-state-persistence",
    stateFilePath: null
  };
}

function createGeneratedCollectionPolicyDescriptor() {
  return {
    configuredMode: "auto",
    runtimeMode: "memory",
    source: "default",
    stateFilePath: null
  };
}

function resolveCollectionPolicyDescriptor(moduleId) {
  if (moduleId === "records") {
    return createReferenceStatePolicyDescriptor();
  }

  return createGeneratedCollectionPolicyDescriptor();
}

function buildRuntimePersistenceMaps(state) {
  const collectionRepositoryModuleMap = {};
  const activeCollectionRepositoryModuleMap = {};
  const collectionRepositoryPolicyMap = {};
  const activeCollectionRepositoryPolicyMap = {};
  const settingsRepositoryModuleMap = {};
  const activeSettingsRepositoryModuleMap = {};
  const settingsRepositoryPolicyMap = {};
  const activeSettingsRepositoryPolicyMap = {};

  for (const moduleItem of state.moduleRuntime ?? []) {
    const moduleId = typeof moduleItem?.id === "string" ? moduleItem.id : "";
    if (!moduleId) {
      continue;
    }

    for (const collectionId of moduleItem.collectionIds ?? []) {
      if (typeof collectionId !== "string" || collectionId.length === 0) {
        continue;
      }
      const descriptor = resolveCollectionPolicyDescriptor(moduleId);
      collectionRepositoryModuleMap[collectionId] = moduleId;
      collectionRepositoryPolicyMap[collectionId] = descriptor;
      if (moduleItem.state === "enabled") {
        activeCollectionRepositoryModuleMap[collectionId] = moduleId;
        activeCollectionRepositoryPolicyMap[collectionId] = descriptor;
      }
    }
  }

  for (const definition of Object.values(state.moduleSettingsDefinitions ?? {})) {
    const moduleId = typeof definition?.moduleId === "string" ? definition.moduleId : "";
    if (!moduleId) {
      continue;
    }

    const runtimeModule = findRuntimeModule(state, moduleId);
    const descriptor = createReferenceStatePolicyDescriptor();
    settingsRepositoryModuleMap[moduleId] = `${moduleId}-settings-persistence`;
    settingsRepositoryPolicyMap[moduleId] = descriptor;

    if (runtimeModule?.state === "enabled") {
      activeSettingsRepositoryModuleMap[moduleId] = `${moduleId}-settings-persistence`;
      activeSettingsRepositoryPolicyMap[moduleId] = descriptor;
    }
  }

  return {
    collectionRepositoryModuleMap,
    activeCollectionRepositoryModuleMap,
    collectionRepositoryPolicyMap,
    activeCollectionRepositoryPolicyMap,
    settingsRepositoryModuleMap,
    activeSettingsRepositoryModuleMap,
    settingsRepositoryPolicyMap,
    activeSettingsRepositoryPolicyMap
  };
}

export {
  buildModuleSettingsReadPayload,
  buildRuntimePersistenceMaps,
  cloneRuntimeModule,
  findRuntimeModule,
  isModuleSettingsStateReady,
  lifecycleErrorResponse,
  lifecycleSuccessResponse,
  normalizeModuleSettingsValues,
  resolveModuleSettingsDefinition,
  validateSettingsPatch
};
