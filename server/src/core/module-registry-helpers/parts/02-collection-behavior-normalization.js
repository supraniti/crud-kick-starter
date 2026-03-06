function createBehaviorValidationError(validationError, message, fieldPath) {
  return validationError("MODULE_MANIFEST_INVALID", message, fieldPath);
}

function validateCollectionBehaviorObject(behavior, fieldPath, validationError) {
  if (!behavior || typeof behavior !== "object" || Array.isArray(behavior)) {
    return createBehaviorValidationError(
      validationError,
      "Collection definition behavior must be an object when provided",
      fieldPath
    );
  }

  return null;
}

function validateBehaviorAllowedKeys(
  behavior,
  fieldPath,
  collectionBehaviorAllowedKeys,
  validationError
) {
  const unknownBehaviorKey = Object.keys(behavior).find(
    (key) => !collectionBehaviorAllowedKeys.has(key)
  );
  if (!unknownBehaviorKey) {
    return null;
  }

  return createBehaviorValidationError(
    validationError,
    `Collection definition behavior field '${unknownBehaviorKey}' is not supported`,
    `${fieldPath}.${unknownBehaviorKey}`
  );
}

function validateBehaviorBooleanField(behavior, key, fieldPath, validationError) {
  if (behavior[key] === undefined || typeof behavior[key] === "boolean") {
    return null;
  }

  return createBehaviorValidationError(
    validationError,
    `Collection definition behavior.${key} must be a boolean when provided`,
    `${fieldPath}.${key}`
  );
}

function validateBehaviorMatch(behavior, fieldPath, validationError) {
  if (
    typeof behavior.enforcePrimaryFieldUnique === "boolean" &&
    typeof behavior.enforceTitleUnique === "boolean" &&
    behavior.enforcePrimaryFieldUnique !== behavior.enforceTitleUnique
  ) {
    return createBehaviorValidationError(
      validationError,
      "Collection definition behavior.enforcePrimaryFieldUnique and behavior.enforceTitleUnique must match when both are provided",
      `${fieldPath}.enforceTitleUnique`
    );
  }

  return null;
}

function validateCollectionBehaviorDefinitionInput({
  behavior,
  fieldPath,
  collectionBehaviorAllowedKeys,
  validationError
}) {
  const invalidObjectError = validateCollectionBehaviorObject(
    behavior,
    fieldPath,
    validationError
  );
  if (invalidObjectError) {
    return invalidObjectError;
  }

  const unsupportedKeyError = validateBehaviorAllowedKeys(
    behavior,
    fieldPath,
    collectionBehaviorAllowedKeys,
    validationError
  );
  if (unsupportedKeyError) {
    return unsupportedKeyError;
  }

  const enforcePrimaryFieldUniqueError = validateBehaviorBooleanField(
    behavior,
    "enforcePrimaryFieldUnique",
    fieldPath,
    validationError
  );
  if (enforcePrimaryFieldUniqueError) {
    return enforcePrimaryFieldUniqueError;
  }

  const enforceTitleUniqueError = validateBehaviorBooleanField(
    behavior,
    "enforceTitleUnique",
    fieldPath,
    validationError
  );
  if (enforceTitleUniqueError) {
    return enforceTitleUniqueError;
  }

  const requirePublishedOnWhenPublishedError = validateBehaviorBooleanField(
    behavior,
    "requirePublishedOnWhenPublished",
    fieldPath,
    validationError
  );
  if (requirePublishedOnWhenPublishedError) {
    return requirePublishedOnWhenPublishedError;
  }

  return validateBehaviorMatch(behavior, fieldPath, validationError);
}

function normalizeCollectionBehaviorValues(behavior) {
  const normalized = {};
  const normalizedEnforcePrimaryFieldUnique =
    typeof behavior.enforcePrimaryFieldUnique === "boolean"
      ? behavior.enforcePrimaryFieldUnique
      : typeof behavior.enforceTitleUnique === "boolean"
        ? behavior.enforceTitleUnique
        : undefined;
  const normalizedEnforceTitleUnique =
    typeof behavior.enforceTitleUnique === "boolean"
      ? behavior.enforceTitleUnique
      : typeof behavior.enforcePrimaryFieldUnique === "boolean"
        ? behavior.enforcePrimaryFieldUnique
        : undefined;

  if (typeof normalizedEnforcePrimaryFieldUnique === "boolean") {
    normalized.enforcePrimaryFieldUnique = normalizedEnforcePrimaryFieldUnique;
  }
  if (typeof normalizedEnforceTitleUnique === "boolean") {
    normalized.enforceTitleUnique = normalizedEnforceTitleUnique;
  }
  if (typeof behavior.requirePublishedOnWhenPublished === "boolean") {
    normalized.requirePublishedOnWhenPublished = behavior.requirePublishedOnWhenPublished;
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

function createCollectionBehaviorDefinitionNormalizer({
  collectionBehaviorAllowedKeys,
  validationError
}) {
  function normalizeCollectionBehaviorDefinition(collection, index) {
    const fieldPath = `collections.${index}.behavior`;
    const behavior = collection?.behavior;

    if (behavior === undefined) {
      return {
        ok: true,
        value: null
      };
    }

    const validationFailure = validateCollectionBehaviorDefinitionInput({
      behavior,
      fieldPath,
      collectionBehaviorAllowedKeys,
      validationError
    });
    if (validationFailure) {
      return {
        ok: false,
        error: validationFailure
      };
    }

    return {
      ok: true,
      value: normalizeCollectionBehaviorValues(behavior)
    };
  }

  return {
    normalizeCollectionBehaviorDefinition
  };
}

export { createCollectionBehaviorDefinitionNormalizer };
