const SUPPORTED_COLLECTION_BEHAVIOR_KEYS = new Set([
  "enforcePrimaryFieldUnique",
  "enforceTitleUnique",
  "requirePublishedOnWhenPublished"
]);

function defaultCollectionBehavior() {
  return {
    enforcePrimaryFieldUnique: true,
    enforceTitleUnique: true,
    requirePublishedOnWhenPublished: true
  };
}

function isValidBehaviorObject(rawBehavior) {
  return rawBehavior && typeof rawBehavior === "object" && !Array.isArray(rawBehavior);
}

function collectUnsupportedCollectionBehaviorKeyDetails(rawBehavior, collectionId) {
  const details = [];
  for (const key of Object.keys(rawBehavior)) {
    if (!SUPPORTED_COLLECTION_BEHAVIOR_KEYS.has(key)) {
      details.push(`collections.${collectionId}.behavior.${key} is not supported`);
    }
  }
  return details;
}

function collectCollectionBehaviorTypeDetails(rawBehavior, collectionId) {
  const details = [];

  if (
    rawBehavior.enforcePrimaryFieldUnique !== undefined &&
    typeof rawBehavior.enforcePrimaryFieldUnique !== "boolean"
  ) {
    details.push(
      `collections.${collectionId}.behavior.enforcePrimaryFieldUnique must be a boolean when provided`
    );
  }

  if (
    rawBehavior.enforceTitleUnique !== undefined &&
    typeof rawBehavior.enforceTitleUnique !== "boolean"
  ) {
    details.push(
      `collections.${collectionId}.behavior.enforceTitleUnique must be a boolean when provided`
    );
  }

  if (
    rawBehavior.requirePublishedOnWhenPublished !== undefined &&
    typeof rawBehavior.requirePublishedOnWhenPublished !== "boolean"
  ) {
    details.push(
      `collections.${collectionId}.behavior.requirePublishedOnWhenPublished must be a boolean when provided`
    );
  }

  return details;
}

function collectCollectionBehaviorConsistencyDetails(rawBehavior, collectionId) {
  if (
    typeof rawBehavior.enforcePrimaryFieldUnique === "boolean" &&
    typeof rawBehavior.enforceTitleUnique === "boolean" &&
    rawBehavior.enforcePrimaryFieldUnique !== rawBehavior.enforceTitleUnique
  ) {
    return [
      `collections.${collectionId}.behavior.enforcePrimaryFieldUnique and enforceTitleUnique must match when both are provided`
    ];
  }

  return [];
}

function collectCollectionBehaviorValidationDetails(rawBehavior, collectionId) {
  if (!isValidBehaviorObject(rawBehavior)) {
    return [`collections.${collectionId}.behavior must be an object when provided`];
  }

  return [
    ...collectUnsupportedCollectionBehaviorKeyDetails(rawBehavior, collectionId),
    ...collectCollectionBehaviorTypeDetails(rawBehavior, collectionId),
    ...collectCollectionBehaviorConsistencyDetails(rawBehavior, collectionId)
  ];
}

function resolveEnforcePrimaryFieldUnique(rawBehavior) {
  if (typeof rawBehavior.enforcePrimaryFieldUnique === "boolean") {
    return rawBehavior.enforcePrimaryFieldUnique;
  }

  if (typeof rawBehavior.enforceTitleUnique === "boolean") {
    return rawBehavior.enforceTitleUnique;
  }

  return true;
}

function normalizeCollectionBehavior(rawBehavior, collectionId) {
  if (rawBehavior === undefined || rawBehavior === null) {
    return defaultCollectionBehavior();
  }

  const details = collectCollectionBehaviorValidationDetails(rawBehavior, collectionId);

  if (details.length > 0) {
    const error = new Error(
      `Generated collection '${collectionId}' includes unsupported behavior configuration`
    );
    error.code = "GENERATED_COLLECTION_BEHAVIOR_UNSUPPORTED";
    error.details = details;
    throw error;
  }

  const enforcePrimaryFieldUnique = resolveEnforcePrimaryFieldUnique(rawBehavior);

  return {
    enforcePrimaryFieldUnique,
    // Preserve legacy key for deterministic compatibility with existing modules.
    enforceTitleUnique: enforcePrimaryFieldUnique,
    requirePublishedOnWhenPublished:
      rawBehavior.requirePublishedOnWhenPublished === undefined
        ? true
        : rawBehavior.requirePublishedOnWhenPublished
  };
}

export { normalizeCollectionBehavior };
