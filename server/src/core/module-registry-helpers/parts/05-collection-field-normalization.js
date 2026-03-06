function normalizeCollectionFieldOptions(fieldOptions) {
  if (!Array.isArray(fieldOptions)) {
    return [];
  }

  const normalized = [];
  const seen = new Set();
  for (const option of fieldOptions) {
    const value =
      typeof option === "string"
        ? option.trim().toLowerCase()
        : option && typeof option === "object" && typeof option.value === "string"
          ? option.value.trim().toLowerCase()
          : "";
    if (value.length === 0 || seen.has(value)) {
      continue;
    }
    seen.add(value);
    normalized.push(value);
  }

  return normalized;
}

function buildCollectionFieldError(validationError, message, path) {
  return {
    ok: false,
    error: validationError("MODULE_MANIFEST_INVALID", message, path)
  };
}

function initializeCollectionFieldDefinition({
  field,
  collectionIndex,
  fieldIndex,
  collectionFieldAllowedKeys,
  collectionFieldIdPatternLabel,
  isCollectionFieldId,
  isSupportedCollectionFieldType,
  listSupportedCollectionFieldTypesLabel,
  validationError
}) {
  const fieldPath = `collections.${collectionIndex}.fields.${fieldIndex}`;
  if (!field || typeof field !== "object" || Array.isArray(field)) {
    return buildCollectionFieldError(
      validationError,
      "Collection field definition must be an object",
      fieldPath
    );
  }

  const unknownFieldKey = Object.keys(field).find((key) => !collectionFieldAllowedKeys.has(key));
  if (unknownFieldKey) {
    return buildCollectionFieldError(
      validationError,
      `Collection field definition field '${unknownFieldKey}' is not supported`,
      `${fieldPath}.${unknownFieldKey}`
    );
  }

  const normalizedId = typeof field.id === "string" ? field.id.trim() : "";
  if (!isCollectionFieldId(normalizedId)) {
    return buildCollectionFieldError(
      validationError,
      `Collection field id must be ${collectionFieldIdPatternLabel}`,
      `${fieldPath}.id`
    );
  }

  const normalizedType = typeof field.type === "string" ? field.type.trim().toLowerCase() : "";
  if (!isSupportedCollectionFieldType(normalizedType)) {
    return buildCollectionFieldError(
      validationError,
      `Collection field type must be one of: ${listSupportedCollectionFieldTypesLabel()}`,
      `${fieldPath}.type`
    );
  }

  if (field.label !== undefined && typeof field.label !== "string") {
    return buildCollectionFieldError(
      validationError,
      "Collection field label must be a string when provided",
      `${fieldPath}.label`
    );
  }

  if (field.required !== undefined && typeof field.required !== "boolean") {
    return buildCollectionFieldError(
      validationError,
      "Collection field required must be a boolean when provided",
      `${fieldPath}.required`
    );
  }

  const normalizedField = {
    id: normalizedId,
    type: normalizedType,
    ...(typeof field.label === "string" && field.label.trim().length > 0
      ? { label: field.label.trim() }
      : {}),
    required: field.required === true
  };

  return {
    ok: true,
    value: {
      fieldPath,
      normalizedType,
      normalizedField
    }
  };
}

function applyTextFieldConstraints({
  field,
  fieldPath,
  normalizedType,
  normalizedField,
  validationError
}) {
  if (normalizedType !== "text") {
    return { ok: true };
  }

  if (field.minLength !== undefined && (!Number.isInteger(field.minLength) || field.minLength < 0)) {
    return buildCollectionFieldError(
      validationError,
      "Collection text field minLength must be an integer >= 0 when provided",
      `${fieldPath}.minLength`
    );
  }

  if (field.maxLength !== undefined && (!Number.isInteger(field.maxLength) || field.maxLength < 0)) {
    return buildCollectionFieldError(
      validationError,
      "Collection text field maxLength must be an integer >= 0 when provided",
      `${fieldPath}.maxLength`
    );
  }

  if (
    Number.isInteger(field.minLength) &&
    Number.isInteger(field.maxLength) &&
    field.maxLength < field.minLength
  ) {
    return buildCollectionFieldError(
      validationError,
      "Collection text field maxLength must be greater than or equal to minLength",
      `${fieldPath}.maxLength`
    );
  }

  if (Number.isInteger(field.minLength)) {
    normalizedField.minLength = field.minLength;
  }
  if (Number.isInteger(field.maxLength)) {
    normalizedField.maxLength = field.maxLength;
  }

  return { ok: true };
}

function resolveConstraintField(constraintReason, normalizedConstraints) {
  if (typeof normalizedConstraints?.field === "string" && normalizedConstraints.field.length > 0) {
    return normalizedConstraints.field;
  }
  if (constraintReason.startsWith("maxLength")) {
    return "maxLength";
  }
  if (constraintReason.startsWith("minLength")) {
    return "minLength";
  }
  return "constraints";
}

function applyFieldTypePluginConstraints({
  field,
  fieldPath,
  normalizedType,
  normalizedField,
  collectionFieldTypePluginSchemaKindsLabel,
  resolveCollectionFieldTypePlugin,
  normalizeCollectionFieldTypePluginSchemaKind,
  validationError
}) {
  const fieldTypePlugin = resolveCollectionFieldTypePlugin(normalizedType);
  if (fieldTypePlugin && typeof fieldTypePlugin === "object") {
    const normalizedPluginSchemaKind = normalizeCollectionFieldTypePluginSchemaKind(
      fieldTypePlugin.schema?.kind
    );
    if (normalizedPluginSchemaKind.length === 0) {
      return buildCollectionFieldError(
        validationError,
        `Collection field type plugin '${normalizedType}' must declare schema.kind as one of: ${collectionFieldTypePluginSchemaKindsLabel}`,
        `${fieldPath}.type`
      );
    }
  }

  if (
    fieldTypePlugin &&
    typeof fieldTypePlugin.normalizeDescriptorConstraints === "function"
  ) {
    const normalizedConstraints = fieldTypePlugin.normalizeDescriptorConstraints(field, {
      strict: true
    });
    if (!normalizedConstraints || normalizedConstraints.ok !== true) {
      const constraintReason =
        typeof normalizedConstraints?.reason === "string"
          ? normalizedConstraints.reason
          : "minLength/maxLength configuration is invalid";
      const constraintField = resolveConstraintField(constraintReason, normalizedConstraints);
      return buildCollectionFieldError(
        validationError,
        `Collection ${normalizedType} field ${constraintReason}`,
        `${fieldPath}.${constraintField}`
      );
    }

    if (
      normalizedConstraints.descriptorPatch &&
      typeof normalizedConstraints.descriptorPatch === "object" &&
      !Array.isArray(normalizedConstraints.descriptorPatch)
    ) {
      Object.assign(normalizedField, normalizedConstraints.descriptorPatch);
    }

    if (Number.isInteger(normalizedConstraints.minLength)) {
      normalizedField.minLength = normalizedConstraints.minLength;
    }
    if (Number.isInteger(normalizedConstraints.maxLength)) {
      normalizedField.maxLength = normalizedConstraints.maxLength;
    }
  }

  return { ok: true };
}

function applyNumberFieldConstraints({
  field,
  fieldPath,
  normalizedType,
  normalizedField,
  validationError
}) {
  if (normalizedType !== "number") {
    return { ok: true };
  }

  if (field.min !== undefined && !Number.isFinite(field.min)) {
    return buildCollectionFieldError(
      validationError,
      "Collection number field min must be a finite number when provided",
      `${fieldPath}.min`
    );
  }

  if (field.max !== undefined && !Number.isFinite(field.max)) {
    return buildCollectionFieldError(
      validationError,
      "Collection number field max must be a finite number when provided",
      `${fieldPath}.max`
    );
  }

  if (Number.isFinite(field.min) && Number.isFinite(field.max) && field.max < field.min) {
    return buildCollectionFieldError(
      validationError,
      "Collection number field max must be greater than or equal to min",
      `${fieldPath}.max`
    );
  }

  if (Number.isFinite(field.min)) {
    normalizedField.min = field.min;
  }
  if (Number.isFinite(field.max)) {
    normalizedField.max = field.max;
  }

  return { ok: true };
}

function applyEnumFieldConstraints({
  field,
  fieldPath,
  normalizedType,
  normalizedField,
  validationError
}) {
  if (normalizedType !== "enum" && normalizedType !== "enum-multi") {
    return { ok: true };
  }

  const normalizedOptions = normalizeCollectionFieldOptions(field.options);
  if (normalizedOptions.length === 0) {
    return buildCollectionFieldError(
      validationError,
      `Collection field options are required for type '${normalizedType}'`,
      `${fieldPath}.options`
    );
  }

  normalizedField.options = normalizedOptions;
  return { ok: true };
}

function resolveUnsupportedReferenceFieldName(field) {
  if (field.labelField !== undefined) {
    return "labelField";
  }
  if (field.onDelete !== undefined) {
    return "onDelete";
  }
  if (field.onDeleteSetting !== undefined) {
    return "onDeleteSetting";
  }
  return "referenceUi";
}

function applyReferenceFieldConstraints({
  field,
  fieldPath,
  normalizedType,
  normalizedField,
  collectionFieldIdPatternLabel,
  referenceDeletePolicyAllowedValues,
  routeSegmentPattern,
  isCollectionFieldId,
  isReferenceCollectionFieldType,
  normalizeReferenceUiDefinition,
  validationError
}) {
  const hasReferenceOnlyFields =
    field.labelField !== undefined ||
    field.onDelete !== undefined ||
    field.onDeleteSetting !== undefined ||
    field.referenceUi !== undefined;

  if (!isReferenceCollectionFieldType(normalizedType)) {
    if (!hasReferenceOnlyFields) {
      return { ok: true };
    }
    const unsupportedFieldName = resolveUnsupportedReferenceFieldName(field);
    return buildCollectionFieldError(
      validationError,
      `Collection field ${unsupportedFieldName} is only supported for reference/reference-multi fields`,
      `${fieldPath}.${unsupportedFieldName}`
    );
  }

  const collectionId = typeof field.collectionId === "string" ? field.collectionId.trim() : "";
  if (!routeSegmentPattern.test(collectionId)) {
    return buildCollectionFieldError(
      validationError,
      "Collection reference field collectionId must be lowercase kebab-case",
      `${fieldPath}.collectionId`
    );
  }

  normalizedField.collectionId = collectionId;

  if (field.labelField !== undefined) {
    const normalizedLabelField = typeof field.labelField === "string" ? field.labelField.trim() : "";
    if (!isCollectionFieldId(normalizedLabelField)) {
      return buildCollectionFieldError(
        validationError,
        `Collection reference field labelField must be ${collectionFieldIdPatternLabel}`,
        `${fieldPath}.labelField`
      );
    }
    normalizedField.labelField = normalizedLabelField;
  }

  if (field.onDelete !== undefined) {
    const normalizedDeletePolicy =
      typeof field.onDelete === "string" ? field.onDelete.trim().toLowerCase() : "";
    if (!referenceDeletePolicyAllowedValues.has(normalizedDeletePolicy)) {
      return buildCollectionFieldError(
        validationError,
        "Collection reference field onDelete must be one of: restrict, nullify",
        `${fieldPath}.onDelete`
      );
    }
    normalizedField.onDelete = normalizedDeletePolicy;
  }

  if (field.onDeleteSetting !== undefined) {
    const normalizedOnDeleteSetting =
      typeof field.onDeleteSetting === "string" ? field.onDeleteSetting.trim() : "";
    if (!isCollectionFieldId(normalizedOnDeleteSetting)) {
      return buildCollectionFieldError(
        validationError,
        `Collection reference field onDeleteSetting must be ${collectionFieldIdPatternLabel}`,
        `${fieldPath}.onDeleteSetting`
      );
    }
    normalizedField.onDeleteSetting = normalizedOnDeleteSetting;
  }

  if (field.referenceUi !== undefined) {
    const normalizedReferenceUi = normalizeReferenceUiDefinition(
      field.referenceUi,
      `${fieldPath}.referenceUi`
    );
    if (!normalizedReferenceUi.ok) {
      return normalizedReferenceUi;
    }
    normalizedField.referenceUi = normalizedReferenceUi.value;
  }

  return { ok: true };
}

function applyComputedAndDefaultConstraints({
  field,
  fieldPath,
  normalizedType,
  normalizedField,
  normalizeComputedCollectionFieldDefinition,
  resolveCollectionFieldDefaultRaw,
  normalizeCollectionFieldDefaultValue
}) {
  const computedFieldValidation = normalizeComputedCollectionFieldDefinition({
    field,
    normalizedType,
    normalizedField,
    fieldPath
  });
  if (!computedFieldValidation.ok) {
    return computedFieldValidation;
  }

  const resolvedDefault = resolveCollectionFieldDefaultRaw(field, fieldPath);
  if (!resolvedDefault.ok) {
    return resolvedDefault;
  }

  if (!resolvedDefault.hasDefault) {
    return { ok: true };
  }

  const normalizedDefault = normalizeCollectionFieldDefaultValue(
    normalizedField,
    resolvedDefault.value,
    fieldPath
  );
  if (!normalizedDefault.ok) {
    return normalizedDefault;
  }

  normalizedField.defaultValue = normalizedDefault.value;
  return { ok: true };
}

function normalizeCollectionFieldDefinitionWithDependencies(dependencies, field, collectionIndex, fieldIndex) {
  const initializedField = initializeCollectionFieldDefinition({
    field,
    collectionIndex,
    fieldIndex,
    collectionFieldAllowedKeys: dependencies.collectionFieldAllowedKeys,
    collectionFieldIdPatternLabel: dependencies.collectionFieldIdPatternLabel,
    isCollectionFieldId: dependencies.isCollectionFieldId,
    isSupportedCollectionFieldType: dependencies.isSupportedCollectionFieldType,
    listSupportedCollectionFieldTypesLabel: dependencies.listSupportedCollectionFieldTypesLabel,
    validationError: dependencies.validationError
  });
  if (!initializedField.ok) {
    return initializedField;
  }

  const { fieldPath, normalizedType, normalizedField } = initializedField.value;

  const textValidation = applyTextFieldConstraints({
    field,
    fieldPath,
    normalizedType,
    normalizedField,
    validationError: dependencies.validationError
  });
  if (!textValidation.ok) {
    return textValidation;
  }

  const fieldTypePluginValidation = applyFieldTypePluginConstraints({
    field,
    fieldPath,
    normalizedType,
    normalizedField,
    collectionFieldTypePluginSchemaKindsLabel: dependencies.collectionFieldTypePluginSchemaKindsLabel,
    resolveCollectionFieldTypePlugin: dependencies.resolveCollectionFieldTypePlugin,
    normalizeCollectionFieldTypePluginSchemaKind: dependencies.normalizeCollectionFieldTypePluginSchemaKind,
    validationError: dependencies.validationError
  });
  if (!fieldTypePluginValidation.ok) {
    return fieldTypePluginValidation;
  }

  const numberValidation = applyNumberFieldConstraints({
    field,
    fieldPath,
    normalizedType,
    normalizedField,
    validationError: dependencies.validationError
  });
  if (!numberValidation.ok) {
    return numberValidation;
  }

  const enumValidation = applyEnumFieldConstraints({
    field,
    fieldPath,
    normalizedType,
    normalizedField,
    validationError: dependencies.validationError
  });
  if (!enumValidation.ok) {
    return enumValidation;
  }

  const referenceValidation = applyReferenceFieldConstraints({
    field,
    fieldPath,
    normalizedType,
    normalizedField,
    collectionFieldIdPatternLabel: dependencies.collectionFieldIdPatternLabel,
    referenceDeletePolicyAllowedValues: dependencies.referenceDeletePolicyAllowedValues,
    routeSegmentPattern: dependencies.routeSegmentPattern,
    isCollectionFieldId: dependencies.isCollectionFieldId,
    isReferenceCollectionFieldType: dependencies.isReferenceCollectionFieldType,
    normalizeReferenceUiDefinition: dependencies.normalizeReferenceUiDefinition,
    validationError: dependencies.validationError
  });
  if (!referenceValidation.ok) {
    return referenceValidation;
  }

  const computedAndDefaultValidation = applyComputedAndDefaultConstraints({
    field,
    fieldPath,
    normalizedType,
    normalizedField,
    normalizeComputedCollectionFieldDefinition: dependencies.normalizeComputedCollectionFieldDefinition,
    resolveCollectionFieldDefaultRaw: dependencies.resolveCollectionFieldDefaultRaw,
    normalizeCollectionFieldDefaultValue: dependencies.normalizeCollectionFieldDefaultValue
  });
  if (!computedAndDefaultValidation.ok) {
    return computedAndDefaultValidation;
  }

  return {
    ok: true,
    value: normalizedField
  };
}

function createCollectionFieldDefinitionNormalizer({
  collectionFieldAllowedKeys,
  collectionFieldIdPatternLabel,
  collectionFieldTypePluginSchemaKindsLabel,
  referenceDeletePolicyAllowedValues,
  routeSegmentPattern,
  isCollectionFieldId,
  isSupportedCollectionFieldType,
  listSupportedCollectionFieldTypesLabel,
  isReferenceCollectionFieldType,
  resolveCollectionFieldTypePlugin,
  normalizeCollectionFieldTypePluginSchemaKind,
  normalizeReferenceUiDefinition,
  normalizeComputedCollectionFieldDefinition,
  resolveCollectionFieldDefaultRaw,
  normalizeCollectionFieldDefaultValue,
  validationError
}) {
  const dependencies = {
    collectionFieldAllowedKeys,
    collectionFieldIdPatternLabel,
    collectionFieldTypePluginSchemaKindsLabel,
    referenceDeletePolicyAllowedValues,
    routeSegmentPattern,
    isCollectionFieldId,
    isSupportedCollectionFieldType,
    listSupportedCollectionFieldTypesLabel,
    isReferenceCollectionFieldType,
    resolveCollectionFieldTypePlugin,
    normalizeCollectionFieldTypePluginSchemaKind,
    normalizeReferenceUiDefinition,
    normalizeComputedCollectionFieldDefinition,
    resolveCollectionFieldDefaultRaw,
    normalizeCollectionFieldDefaultValue,
    validationError
  };

  function normalizeCollectionFieldDefinition(field, collectionIndex, fieldIndex) {
    return normalizeCollectionFieldDefinitionWithDependencies(
      dependencies,
      field,
      collectionIndex,
      fieldIndex
    );
  }

  return {
    normalizeCollectionFieldOptions,
    normalizeCollectionFieldDefinition
  };
}

export { createCollectionFieldDefinitionNormalizer };
