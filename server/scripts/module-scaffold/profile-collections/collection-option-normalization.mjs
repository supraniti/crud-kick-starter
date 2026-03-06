function normalizeProfileOptionValues(input, details, pathLabel) {
  if (input === undefined) {
    return null;
  }

  if (!Array.isArray(input)) {
    details.push(`${pathLabel} must be an array of string options when provided`);
    return [];
  }

  const normalized = input
    .map((value) => (typeof value === "string" ? value.trim().toLowerCase() : ""))
    .filter(Boolean);

  if (normalized.length === 0) {
    details.push(`${pathLabel} must include at least one non-empty option`);
    return [];
  }

  if (normalized.some((value) => !/^[a-z0-9-]+$/.test(value))) {
    details.push(`${pathLabel} options must match /^[a-z0-9-]+$/`);
    return [];
  }

  return [...new Set(normalized)];
}

function normalizeProfileCollectionBehavior(rawBehavior, details, pathLabel) {
  const defaults = {
    enforcePrimaryFieldUnique: true,
    enforceTitleUnique: true,
    requirePublishedOnWhenPublished: true
  };

  if (rawBehavior === undefined) {
    return defaults;
  }

  if (!rawBehavior || typeof rawBehavior !== "object" || Array.isArray(rawBehavior)) {
    details.push(`${pathLabel} must be an object when provided`);
    return defaults;
  }

  const next = {
    ...defaults
  };

  if (rawBehavior.enforcePrimaryFieldUnique !== undefined) {
    if (typeof rawBehavior.enforcePrimaryFieldUnique !== "boolean") {
      details.push(`${pathLabel}.enforcePrimaryFieldUnique must be a boolean when provided`);
    } else {
      next.enforcePrimaryFieldUnique = rawBehavior.enforcePrimaryFieldUnique;
    }
  }

  if (rawBehavior.enforceTitleUnique !== undefined) {
    if (typeof rawBehavior.enforceTitleUnique !== "boolean") {
      details.push(`${pathLabel}.enforceTitleUnique must be a boolean when provided`);
    } else {
      next.enforceTitleUnique = rawBehavior.enforceTitleUnique;
    }
  }

  if (rawBehavior.requirePublishedOnWhenPublished !== undefined) {
    if (typeof rawBehavior.requirePublishedOnWhenPublished !== "boolean") {
      details.push(`${pathLabel}.requirePublishedOnWhenPublished must be a boolean when provided`);
    } else {
      next.requirePublishedOnWhenPublished =
        rawBehavior.requirePublishedOnWhenPublished;
    }
  }

  if (
    typeof rawBehavior.enforcePrimaryFieldUnique === "boolean" &&
    typeof rawBehavior.enforceTitleUnique === "boolean" &&
    rawBehavior.enforcePrimaryFieldUnique !== rawBehavior.enforceTitleUnique
  ) {
    details.push(
      `${pathLabel}.enforcePrimaryFieldUnique and ${pathLabel}.enforceTitleUnique must match when both are provided`
    );
  }

  const enforcePrimaryFieldUnique =
    typeof rawBehavior.enforcePrimaryFieldUnique === "boolean"
      ? rawBehavior.enforcePrimaryFieldUnique
      : typeof rawBehavior.enforceTitleUnique === "boolean"
        ? rawBehavior.enforceTitleUnique
        : true;
  next.enforcePrimaryFieldUnique = enforcePrimaryFieldUnique;
  // Preserve legacy key for deterministic compatibility.
  next.enforceTitleUnique = enforcePrimaryFieldUnique;

  return next;
}

export { normalizeProfileCollectionBehavior, normalizeProfileOptionValues };
