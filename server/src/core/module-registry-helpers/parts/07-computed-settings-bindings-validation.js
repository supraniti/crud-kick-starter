function resolveSettingsFieldByPath(settingsFields, settingPath) {
  const normalizedPath = typeof settingPath === "string" ? settingPath.trim() : "";
  if (normalizedPath.length === 0) {
    return null;
  }

  const segments = normalizedPath
    .split(".")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    return null;
  }

  let currentFields = settingsFields;
  let resolvedField = null;
  for (const segment of segments) {
    const nextField =
      currentFields.find(
        (field) => field && typeof field.id === "string" && field.id === segment
      ) ?? null;
    if (!nextField) {
      return null;
    }
    resolvedField = nextField;
    currentFields = Array.isArray(nextField.fields) ? nextField.fields : [];
  }

  return resolvedField;
}

function createCollectionComputedSettingsBindingsValidator({
  defaultComputedResolver,
  resolveComputedResolverSettingOptionSchema,
  validationError
}) {
  function createBindingsValidationFailure(message, fieldPath) {
    return {
      ok: false,
      error: validationError("MODULE_MANIFEST_INVALID", message, fieldPath)
    };
  }

  function validateResolverSettingBinding({
    collectionIndex,
    fieldIndex,
    resolver,
    optionKey,
    settingFieldId,
    settingsFields
  }) {
    const optionPath = `collections.${collectionIndex}.fields.${fieldIndex}.settings.${optionKey}`;
    const schema = resolveComputedResolverSettingOptionSchema(resolver, optionKey);
    if (!schema) {
      return createBindingsValidationFailure(
        `Collection computed field settings option '${optionKey}' is not supported for resolver '${resolver}'`,
        optionPath
      );
    }

    const settingField = resolveSettingsFieldByPath(settingsFields, settingFieldId);
    if (!settingField) {
      return createBindingsValidationFailure(
        `Collection computed field settings option '${optionKey}' references unknown module setting '${settingFieldId}'`,
        optionPath
      );
    }

    const allowedSettingTypes = Array.isArray(schema.settingTypes) ? schema.settingTypes : [];
    if (
      allowedSettingTypes.length > 0 &&
      !allowedSettingTypes.includes(settingField.type)
    ) {
      return createBindingsValidationFailure(
        `Collection computed field settings option '${optionKey}' requires setting type ${allowedSettingTypes.join(", ")} but '${settingFieldId}' is '${settingField.type}'`,
        optionPath
      );
    }

    return null;
  }

  function validateComputedFieldSettingsBindings({
    collectionIndex,
    fieldIndex,
    field,
    settingsFields
  }) {
    const resolver = field.resolver ?? defaultComputedResolver;
    const settingEntries = Object.entries(field.settings);
    if (settingEntries.length === 0) {
      return null;
    }

    if (settingsFields.length === 0) {
      return createBindingsValidationFailure(
        "Collection computed field settings bindings require module settings definition",
        `collections.${collectionIndex}.fields.${fieldIndex}.settings`
      );
    }

    for (const [optionKey, settingFieldId] of settingEntries) {
      const settingBindingFailure = validateResolverSettingBinding({
        collectionIndex,
        fieldIndex,
        resolver,
        optionKey,
        settingFieldId,
        settingsFields
      });
      if (settingBindingFailure) {
        return settingBindingFailure;
      }
    }

    return null;
  }

  function validateCollectionComputedSettingsBindings(
    collections,
    settingsDefinition
  ) {
    const settingsFields = Array.isArray(settingsDefinition?.fields)
      ? settingsDefinition.fields
      : [];

    for (const [collectionIndex, collection] of (collections ?? []).entries()) {
      const fields = Array.isArray(collection?.fields) ? collection.fields : [];
      for (const [fieldIndex, field] of fields.entries()) {
        if (field?.type !== "computed" || !field.settings || typeof field.settings !== "object") {
          continue;
        }

        const validationFailure = validateComputedFieldSettingsBindings({
          collectionIndex,
          fieldIndex,
          field,
          settingsFields
        });
        if (validationFailure) {
          return validationFailure;
        }
      }
    }

    return {
      ok: true
    };
  }

  return {
    validateCollectionComputedSettingsBindings
  };
}

export { createCollectionComputedSettingsBindingsValidator };
