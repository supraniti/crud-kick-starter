function buildCollectionValidationError(validationError, message, path) {
  return {
    ok: false,
    error: validationError("MODULE_MANIFEST_INVALID", message, path)
  };
}

function initializeCollectionDefinitionContext(dependencies, collection, index) {
  const fieldPath = `collections.${index}`;
  if (!collection || typeof collection !== "object") {
    return buildCollectionValidationError(
      dependencies.validationError,
      "Collection definition must be an object",
      fieldPath
    );
  }

  if (typeof collection.id !== "string" || collection.id.trim().length === 0) {
    return buildCollectionValidationError(
      dependencies.validationError,
      "Collection definition id is required",
      `${fieldPath}.id`
    );
  }

  if (typeof collection.label !== "string" || collection.label.trim().length === 0) {
    return buildCollectionValidationError(
      dependencies.validationError,
      "Collection definition label is required",
      `${fieldPath}.label`
    );
  }

  const primaryField =
    typeof collection.primaryField === "string" ? collection.primaryField.trim() : "";
  if (primaryField.length === 0) {
    return buildCollectionValidationError(
      dependencies.validationError,
      "Collection definition primaryField is required",
      `${fieldPath}.primaryField`
    );
  }

  let entitySingular = null;
  if (collection.entitySingular !== undefined) {
    if (typeof collection.entitySingular !== "string") {
      return buildCollectionValidationError(
        dependencies.validationError,
        "Collection definition entitySingular must be a string",
        `${fieldPath}.entitySingular`
      );
    }

    entitySingular = collection.entitySingular.trim();
    if (!dependencies.entitySingularPattern.test(entitySingular)) {
      return buildCollectionValidationError(
        dependencies.validationError,
        "Collection definition entitySingular must be lowercase kebab-case",
        `${fieldPath}.entitySingular`
      );
    }
  }

  if (!Array.isArray(collection.fields)) {
    return buildCollectionValidationError(
      dependencies.validationError,
      "Collection definition fields must be an array",
      `${fieldPath}.fields`
    );
  }

  if (!collection.capabilities || typeof collection.capabilities !== "object") {
    return buildCollectionValidationError(
      dependencies.validationError,
      "Collection definition capabilities object is required",
      `${fieldPath}.capabilities`
    );
  }

  return {
    ok: true,
    value: {
      fieldPath,
      primaryField,
      entitySingular
    }
  };
}

function normalizeCollectionFields(dependencies, collection, index) {
  const normalizedFields = [];
  const seenFieldIds = new Set();
  for (const [fieldIndex, field] of collection.fields.entries()) {
    const fieldValidation = dependencies.normalizeCollectionFieldDefinition(field, index, fieldIndex);
    if (!fieldValidation.ok) {
      return fieldValidation;
    }

    if (seenFieldIds.has(fieldValidation.value.id)) {
      return buildCollectionValidationError(
        dependencies.validationError,
        `Collection field id '${fieldValidation.value.id}' must be unique`,
        `collections.${index}.fields.${fieldIndex}.id`
      );
    }

    seenFieldIds.add(fieldValidation.value.id);
    normalizedFields.push(fieldValidation.value);
  }

  return {
    ok: true,
    value: normalizedFields
  };
}

function validateCollectionPrimaryField(dependencies, normalizedFields, primaryField, fieldPath) {
  if (normalizedFields.length === 0) {
    return { ok: true };
  }

  const primaryFieldDescriptor = normalizedFields.find((field) => field.id === primaryField) ?? null;
  if (!primaryFieldDescriptor) {
    return buildCollectionValidationError(
      dependencies.validationError,
      `Collection definition primaryField '${primaryField}' must reference one of its fields`,
      `${fieldPath}.primaryField`
    );
  }

  if (primaryFieldDescriptor.type !== "text") {
    return buildCollectionValidationError(
      dependencies.validationError,
      `Collection definition primaryField '${primaryField}' must reference a text field`,
      `${fieldPath}.primaryField`
    );
  }

  return { ok: true };
}

function buildNormalizedCollectionValue(collection, entitySingular, primaryField, normalizedFields, behavior) {
  return {
    id: collection.id,
    label: collection.label,
    ...(entitySingular ? { entitySingular } : {}),
    primaryField,
    description: typeof collection.description === "string" ? collection.description : "",
    capabilities: { ...collection.capabilities },
    fields: normalizedFields,
    ...(behavior ? { behavior } : {})
  };
}

function normalizeCollectionDefinitionWithDependencies(dependencies, collection, index) {
  const context = initializeCollectionDefinitionContext(dependencies, collection, index);
  if (!context.ok) {
    return context;
  }

  const normalizedFields = normalizeCollectionFields(dependencies, collection, index);
  if (!normalizedFields.ok) {
    return normalizedFields;
  }

  const primaryFieldValidation = validateCollectionPrimaryField(
    dependencies,
    normalizedFields.value,
    context.value.primaryField,
    context.value.fieldPath
  );
  if (!primaryFieldValidation.ok) {
    return primaryFieldValidation;
  }

  const behaviorValidation = dependencies.normalizeCollectionBehaviorDefinition(collection, index);
  if (!behaviorValidation.ok) {
    return behaviorValidation;
  }

  return {
    ok: true,
    value: buildNormalizedCollectionValue(
      collection,
      context.value.entitySingular,
      context.value.primaryField,
      normalizedFields.value,
      behaviorValidation.value
    )
  };
}

function createCollectionDefinitionNormalizer({
  entitySingularPattern,
  normalizeCollectionFieldDefinition,
  normalizeCollectionBehaviorDefinition,
  validationError
}) {
  const dependencies = {
    entitySingularPattern,
    normalizeCollectionFieldDefinition,
    normalizeCollectionBehaviorDefinition,
    validationError
  };

  function normalizeCollectionDefinition(collection, index) {
    return normalizeCollectionDefinitionWithDependencies(dependencies, collection, index);
  }

  return {
    normalizeCollectionDefinition
  };
}

export { createCollectionDefinitionNormalizer };
