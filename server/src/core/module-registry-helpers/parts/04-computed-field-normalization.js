function ensureComputedFieldSettingsUsage({ normalizedType, field, fieldPath, validationError }) {
  if (normalizedType !== "computed" && field.settings !== undefined) {
    return {
      ok: false,
      error: validationError(
        "MODULE_MANIFEST_INVALID",
        "Collection field settings bindings are only supported for computed fields",
        `${fieldPath}.settings`
      )
    };
  }

  return {
    ok: true
  };
}

function resolveComputedSource({
  field,
  fieldPath,
  isCollectionFieldId,
  collectionFieldIdPatternLabel,
  validationError
}) {
  const source = typeof field.source === "string" ? field.source.trim() : "";
  if (isCollectionFieldId(source)) {
    return {
      ok: true,
      value: source
    };
  }

  return {
    ok: false,
    error: validationError(
      "MODULE_MANIFEST_INVALID",
      `Collection computed field source must reference a valid field id (${collectionFieldIdPatternLabel})`,
      `${fieldPath}.source`
    )
  };
}

function resolveComputedResolver({
  field,
  fieldPath,
  normalizeComputedResolverToken,
  isSupportedComputedResolverToken,
  supportedComputedResolversLabel,
  defaultComputedResolver,
  validationError
}) {
  const resolver =
    field.resolver !== undefined
      ? normalizeComputedResolverToken(field.resolver)
      : normalizeComputedResolverToken(field.transform);
  if (resolver !== null && !isSupportedComputedResolverToken(resolver)) {
    return {
      ok: false,
      error: validationError(
        "MODULE_MANIFEST_INVALID",
        `Collection computed field resolver must be one of: ${supportedComputedResolversLabel}`,
        field.resolver !== undefined ? `${fieldPath}.resolver` : `${fieldPath}.transform`
      )
    };
  }

  return {
    ok: true,
    value: resolver ?? defaultComputedResolver
  };
}

function normalizeComputedSettingsBindings({
  field,
  fieldPath,
  resolver,
  resolveComputedResolverSettingOptionSchema,
  validationError
}) {
  if (field.settings === undefined) {
    return {
      ok: true,
      value: null
    };
  }

  if (!field.settings || typeof field.settings !== "object" || Array.isArray(field.settings)) {
    return {
      ok: false,
      error: validationError(
        "MODULE_MANIFEST_INVALID",
        "Collection computed field settings must be an object when provided",
        `${fieldPath}.settings`
      )
    };
  }

  const normalizedSettings = {};
  for (const [rawOptionKey, rawSettingFieldId] of Object.entries(field.settings)) {
    const optionKey = typeof rawOptionKey === "string" ? rawOptionKey.trim() : "";
    const settingFieldId = typeof rawSettingFieldId === "string" ? rawSettingFieldId.trim() : "";
    if (optionKey.length === 0) {
      return {
        ok: false,
        error: validationError(
          "MODULE_MANIFEST_INVALID",
          "Collection computed field settings option key must be non-empty",
          `${fieldPath}.settings`
        )
      };
    }

    if (settingFieldId.length === 0) {
      return {
        ok: false,
        error: validationError(
          "MODULE_MANIFEST_INVALID",
          "Collection computed field settings binding must reference a non-empty setting id",
          `${fieldPath}.settings.${optionKey}`
        )
      };
    }

    if (!resolveComputedResolverSettingOptionSchema(resolver, optionKey)) {
      return {
        ok: false,
        error: validationError(
          "MODULE_MANIFEST_INVALID",
          `Collection computed field settings option '${optionKey}' is not supported for resolver '${resolver}'`,
          `${fieldPath}.settings.${optionKey}`
        )
      };
    }

    normalizedSettings[optionKey] = settingFieldId;
  }

  if (Object.keys(normalizedSettings).length === 0) {
    return {
      ok: true,
      value: null
    };
  }

  return {
    ok: true,
    value: normalizedSettings
  };
}

function createComputedCollectionFieldNormalizer({
  collectionFieldIdPatternLabel,
  defaultComputedResolver,
  isCollectionFieldId,
  isSupportedComputedResolverToken,
  normalizeComputedResolverToken,
  resolveComputedResolverSettingOptionSchema,
  supportedComputedResolversLabel,
  validationError
}) {
  function normalizeComputedCollectionFieldDefinition({
    field,
    normalizedType,
    normalizedField,
    fieldPath
  }) {
    const settingsUsageValidation = ensureComputedFieldSettingsUsage({
      normalizedType,
      field,
      fieldPath,
      validationError
    });
    if (!settingsUsageValidation.ok) {
      return settingsUsageValidation;
    }

    if (normalizedType !== "computed") {
      return {
        ok: true
      };
    }

    const sourceValidation = resolveComputedSource({
      field,
      fieldPath,
      isCollectionFieldId,
      collectionFieldIdPatternLabel,
      validationError
    });
    if (!sourceValidation.ok) {
      return sourceValidation;
    }

    const resolverValidation = resolveComputedResolver({
      field,
      fieldPath,
      normalizeComputedResolverToken,
      isSupportedComputedResolverToken,
      supportedComputedResolversLabel,
      defaultComputedResolver,
      validationError
    });
    if (!resolverValidation.ok) {
      return resolverValidation;
    }

    normalizedField.source = sourceValidation.value;
    normalizedField.resolver = resolverValidation.value;
    normalizedField.transform = normalizedField.resolver;

    const settingsValidation = normalizeComputedSettingsBindings({
      field,
      fieldPath,
      resolver: normalizedField.resolver,
      resolveComputedResolverSettingOptionSchema,
      validationError
    });
    if (!settingsValidation.ok) {
      return settingsValidation;
    }

    if (settingsValidation.value) {
      normalizedField.settings = settingsValidation.value;
    }

    return {
      ok: true
    };
  }

  return {
    normalizeComputedCollectionFieldDefinition
  };
}

export { createComputedCollectionFieldNormalizer };
