function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function cloneSettingValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneSettingValue(entry));
  }

  if (isObject(value)) {
    const next = {};
    for (const [key, entry] of Object.entries(value)) {
      next[key] = cloneSettingValue(entry);
    }
    return next;
  }

  return value;
}

function defaultValueForSettingsField(field = {}) {
  if (Object.prototype.hasOwnProperty.call(field, "defaultValue")) {
    return cloneSettingValue(field.defaultValue);
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
      if (!nestedField || typeof nestedField.id !== "string" || nestedField.id.length === 0) {
        continue;
      }
      value[nestedField.id] = defaultValueForSettingsField(nestedField);
    }
    return value;
  }

  return null;
}

function normalizeSettingsFieldValue(field = {}, candidateValue) {
  const fallbackValue = defaultValueForSettingsField(field);

  if (candidateValue === undefined) {
    return fallbackValue;
  }

  if (field.type === "object") {
    if (!isObject(candidateValue)) {
      return fallbackValue;
    }

    const value = {};
    for (const nestedField of field.fields ?? []) {
      if (!nestedField || typeof nestedField.id !== "string" || nestedField.id.length === 0) {
        continue;
      }
      value[nestedField.id] = normalizeSettingsFieldValue(
        nestedField,
        candidateValue[nestedField.id]
      );
    }
    return value;
  }

  if (field.type === "enum-multi") {
    if (!Array.isArray(candidateValue)) {
      return fallbackValue;
    }
    return cloneSettingValue(candidateValue.filter((value) => typeof value === "string"));
  }

  return cloneSettingValue(candidateValue);
}

function createDefaultModuleSettingsValues(settingsDefinition = null) {
  const values = {};
  const fields = Array.isArray(settingsDefinition?.fields)
    ? settingsDefinition.fields
    : [];

  for (const field of fields) {
    if (!field || typeof field.id !== "string" || field.id.length === 0) {
      continue;
    }
    values[field.id] = defaultValueForSettingsField(field);
  }

  return values;
}

function normalizeModuleSettingsValues(
  settingsDefinition = null,
  rawModuleSettings = null
) {
  const defaults = createDefaultModuleSettingsValues(settingsDefinition);
  if (!isObject(rawModuleSettings)) {
    return defaults;
  }

  const fields = Array.isArray(settingsDefinition?.fields)
    ? settingsDefinition.fields
    : [];
  for (const field of fields) {
    if (
      !field ||
      typeof field.id !== "string" ||
      field.id.length === 0 ||
      !Object.prototype.hasOwnProperty.call(rawModuleSettings, field.id)
    ) {
      continue;
    }

    const candidateValue = rawModuleSettings[field.id];
    defaults[field.id] = normalizeSettingsFieldValue(field, candidateValue);
  }

  return defaults;
}

async function resolveGeneratedModuleSettingsValues({
  moduleId,
  settingsDefinition,
  resolveSettingsRepository
}) {
  const defaults = createDefaultModuleSettingsValues(settingsDefinition);
  if (
    typeof moduleId !== "string" ||
    moduleId.length === 0 ||
    typeof resolveSettingsRepository !== "function"
  ) {
    return defaults;
  }

  const repository = resolveSettingsRepository(moduleId);
  if (!repository || typeof repository.readState !== "function") {
    return defaults;
  }

  try {
    const settingsState = await repository.readState();
    const rawModuleSettings = isObject(settingsState)
      ? settingsState[moduleId]
      : null;
    return normalizeModuleSettingsValues(settingsDefinition, rawModuleSettings);
  } catch {
    return defaults;
  }
}

export { resolveGeneratedModuleSettingsValues };
