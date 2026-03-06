function resolveSettingsFieldPathPrefix(options = {}) {
  return typeof options.pathPrefix === "string" && options.pathPrefix.length > 0
    ? options.pathPrefix
    : "settings.fields";
}

function createSettingsFieldDiagnostic(createDiagnostic, code, message, details) {
  return {
    ok: false,
    error: createDiagnostic(code, message, details)
  };
}

function initializeSettingsFieldContext({
  MODULE_SETTINGS_FIELD_TYPES,
  SETTINGS_FIELD_ALLOWED_KEYS,
  createDiagnostic,
  firstUnknownKey,
  isObject
}, moduleId, rawField, index, seenFieldIds, options = {}) {
  const pathPrefix = resolveSettingsFieldPathPrefix(options);
  const fieldPath = `${pathPrefix}.${index}`;

  if (!isObject(rawField)) {
    return createSettingsFieldDiagnostic(
      createDiagnostic,
      "MODULE_SETTINGS_SCHEMA_INVALID",
      `Module '${moduleId}' settings field at index ${index} must be an object`,
      {
        moduleId
      }
    );
  }

  const unknownField = firstUnknownKey(rawField, SETTINGS_FIELD_ALLOWED_KEYS);
  if (unknownField) {
    return createSettingsFieldDiagnostic(
      createDiagnostic,
      "MODULE_SETTINGS_SCHEMA_UNKNOWN_FIELD",
      `Module '${moduleId}' settings field '${unknownField}' is not supported`,
      {
        moduleId,
        field: `${fieldPath}.${unknownField}`
      }
    );
  }

  const fieldId = typeof rawField.id === "string" ? rawField.id.trim() : "";
  if (fieldId.length === 0) {
    return createSettingsFieldDiagnostic(
      createDiagnostic,
      "MODULE_SETTINGS_SCHEMA_INVALID",
      `Module '${moduleId}' settings field at index ${index} requires a non-empty id`,
      {
        moduleId,
        field: `${fieldPath}.id`
      }
    );
  }

  if (seenFieldIds.has(fieldId)) {
    return createSettingsFieldDiagnostic(
      createDiagnostic,
      "MODULE_SETTINGS_SCHEMA_INVALID",
      `Module '${moduleId}' settings field '${fieldId}' is duplicated`,
      {
        moduleId,
        fieldId
      }
    );
  }
  seenFieldIds.add(fieldId);

  const type = typeof rawField.type === "string" ? rawField.type.trim() : "";
  if (!MODULE_SETTINGS_FIELD_TYPES.has(type)) {
    return createSettingsFieldDiagnostic(
      createDiagnostic,
      "MODULE_SETTINGS_SCHEMA_INVALID",
      `Module '${moduleId}' settings field '${fieldId}' has invalid type '${type || "<empty>"}'`,
      {
        moduleId,
        fieldId
      }
    );
  }

  const normalizedField = {
    id: fieldId,
    label:
      typeof rawField.label === "string" && rawField.label.trim().length > 0
        ? rawField.label
        : fieldId,
    type,
    required: rawField.required === true,
    sensitive: rawField.sensitive === true,
    description: typeof rawField.description === "string" ? rawField.description : ""
  };

  return {
    ok: true,
    value: {
      fieldPath,
      fieldId,
      type,
      normalizedField
    }
  };
}

function applyEnumOptionsToSettingsField({ normalizeEnumOptions }, moduleId, fieldId, type, rawField, normalizedField) {
  if (type !== "enum" && type !== "enum-multi") {
    return { ok: true };
  }

  const normalizedOptions = normalizeEnumOptions(moduleId, fieldId, rawField.options);
  if (!normalizedOptions.ok) {
    return normalizedOptions;
  }

  normalizedField.options = normalizedOptions.value;
  return { ok: true };
}

function applyObjectSettingsFieldRules(dependencies, context, recursiveNormalize) {
  const { createDiagnostic } = dependencies;
  const { moduleId, fieldPath, fieldId, type, rawField, normalizedField } = context;

  if (type === "object") {
    if (!Array.isArray(rawField.fields) || rawField.fields.length === 0) {
      return createSettingsFieldDiagnostic(
        createDiagnostic,
        "MODULE_SETTINGS_SCHEMA_INVALID",
        `Module '${moduleId}' settings field '${fieldId}' must include a non-empty fields array`,
        {
          moduleId,
          fieldId
        }
      );
    }

    const nestedSeenFieldIds = new Set();
    const nestedFields = [];
    for (const [nestedIndex, nestedRawField] of rawField.fields.entries()) {
      const normalizedNestedField = recursiveNormalize(
        moduleId,
        nestedRawField,
        nestedIndex,
        nestedSeenFieldIds,
        {
          pathPrefix: `${fieldPath}.fields`
        }
      );
      if (!normalizedNestedField.ok) {
        return normalizedNestedField;
      }
      nestedFields.push(normalizedNestedField.value);
    }

    normalizedField.fields = nestedFields;
    return { ok: true };
  }

  if (rawField.fields !== undefined) {
    return createSettingsFieldDiagnostic(
      createDiagnostic,
      "MODULE_SETTINGS_SCHEMA_INVALID",
      `Module '${moduleId}' settings field '${fieldId}' fields is only supported for object type`,
      {
        moduleId,
        fieldId
      }
    );
  }

  return { ok: true };
}

function applyNumberSettingsFieldRules({ createDiagnostic }, moduleId, fieldId, type, rawField, normalizedField) {
  if (type !== "number") {
    return { ok: true };
  }

  if (rawField.min !== undefined) {
    if (typeof rawField.min !== "number" || !Number.isFinite(rawField.min)) {
      return createSettingsFieldDiagnostic(
        createDiagnostic,
        "MODULE_SETTINGS_SCHEMA_INVALID",
        `Module '${moduleId}' settings field '${fieldId}' min must be a finite number`,
        {
          moduleId,
          fieldId
        }
      );
    }
    normalizedField.min = rawField.min;
  }

  if (rawField.max !== undefined) {
    if (typeof rawField.max !== "number" || !Number.isFinite(rawField.max)) {
      return createSettingsFieldDiagnostic(
        createDiagnostic,
        "MODULE_SETTINGS_SCHEMA_INVALID",
        `Module '${moduleId}' settings field '${fieldId}' max must be a finite number`,
        {
          moduleId,
          fieldId
        }
      );
    }
    normalizedField.max = rawField.max;
  }

  if (
    typeof normalizedField.min === "number" &&
    typeof normalizedField.max === "number" &&
    normalizedField.min > normalizedField.max
  ) {
    return createSettingsFieldDiagnostic(
      createDiagnostic,
      "MODULE_SETTINGS_SCHEMA_INVALID",
      `Module '${moduleId}' settings field '${fieldId}' min cannot be greater than max`,
      {
        moduleId,
        fieldId
      }
    );
  }

  return { ok: true };
}

function applySettingsFieldDefault(dependencies, moduleId, fieldPath, fieldId, rawField, normalizedField) {
  const resolvedDefault = dependencies.resolveFieldDefaultRaw(moduleId, fieldPath, fieldId, rawField);
  if (!resolvedDefault.ok) {
    return resolvedDefault;
  }

  const normalizedDefaultValue = dependencies.normalizeDefaultValue(
    moduleId,
    normalizedField,
    resolvedDefault.value
  );
  if (!normalizedDefaultValue.ok) {
    return normalizedDefaultValue;
  }

  normalizedField.defaultValue = normalizedDefaultValue.value;
  return { ok: true };
}

function normalizeSettingsFieldWithDependencies(
  dependencies,
  moduleId,
  rawField,
  index,
  seenFieldIds,
  options = {}
) {
  const initializedField = initializeSettingsFieldContext(
    dependencies,
    moduleId,
    rawField,
    index,
    seenFieldIds,
    options
  );
  if (!initializedField.ok) {
    return initializedField;
  }

  const { fieldPath, fieldId, type, normalizedField } = initializedField.value;

  const enumOptionsValidation = applyEnumOptionsToSettingsField(
    dependencies,
    moduleId,
    fieldId,
    type,
    rawField,
    normalizedField
  );
  if (!enumOptionsValidation.ok) {
    return enumOptionsValidation;
  }

  const objectFieldValidation = applyObjectSettingsFieldRules(
    dependencies,
    {
      moduleId,
      fieldPath,
      fieldId,
      type,
      rawField,
      normalizedField
    },
    (nextModuleId, nextRawField, nextIndex, nextSeenFieldIds, nextOptions = {}) =>
      normalizeSettingsFieldWithDependencies(
        dependencies,
        nextModuleId,
        nextRawField,
        nextIndex,
        nextSeenFieldIds,
        nextOptions
      )
  );
  if (!objectFieldValidation.ok) {
    return objectFieldValidation;
  }

  const numberFieldValidation = applyNumberSettingsFieldRules(
    dependencies,
    moduleId,
    fieldId,
    type,
    rawField,
    normalizedField
  );
  if (!numberFieldValidation.ok) {
    return numberFieldValidation;
  }

  const defaultValidation = applySettingsFieldDefault(
    dependencies,
    moduleId,
    fieldPath,
    fieldId,
    rawField,
    normalizedField
  );
  if (!defaultValidation.ok) {
    return defaultValidation;
  }

  return {
    ok: true,
    value: normalizedField
  };
}

function createNormalizeSettingsField({
  MODULE_SETTINGS_FIELD_TYPES,
  SETTINGS_FIELD_ALLOWED_KEYS,
  createDiagnostic,
  firstUnknownKey,
  isObject,
  normalizeEnumOptions,
  resolveFieldDefaultRaw,
  normalizeDefaultValue
}) {
  const dependencies = {
    MODULE_SETTINGS_FIELD_TYPES,
    SETTINGS_FIELD_ALLOWED_KEYS,
    createDiagnostic,
    firstUnknownKey,
    isObject,
    normalizeEnumOptions,
    resolveFieldDefaultRaw,
    normalizeDefaultValue
  };

  return function normalizeSettingsField(moduleId, rawField, index, seenFieldIds, options = {}) {
    return normalizeSettingsFieldWithDependencies(
      dependencies,
      moduleId,
      rawField,
      index,
      seenFieldIds,
      options
    );
  };
}

export { createNormalizeSettingsField };
