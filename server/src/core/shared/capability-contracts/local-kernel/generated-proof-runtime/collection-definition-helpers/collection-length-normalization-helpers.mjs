function normalizePositiveInteger(rawValue) {
  if (rawValue === undefined) {
    return undefined;
  }
  if (Number.isInteger(rawValue) && rawValue >= 1) {
    return rawValue;
  }
  return null;
}

function resolveRawLengthConfiguration(rawCollection) {
  return {
    rawPrimaryFieldMinLength: normalizePositiveInteger(rawCollection?.primaryFieldMinLength),
    rawPrimaryFieldMaxLength: normalizePositiveInteger(rawCollection?.primaryFieldMaxLength),
    rawTitleMinLength: normalizePositiveInteger(rawCollection?.titleMinLength),
    rawTitleMaxLength: normalizePositiveInteger(rawCollection?.titleMaxLength)
  };
}

function collectInvalidLengthMessages(rawLengths, collectionId) {
  const details = [];
  if (rawLengths.rawPrimaryFieldMinLength === null) {
    details.push(
      `collections.${collectionId}.primaryFieldMinLength must be an integer >= 1 when provided`
    );
  }
  if (rawLengths.rawPrimaryFieldMaxLength === null) {
    details.push(
      `collections.${collectionId}.primaryFieldMaxLength must be an integer >= 1 when provided`
    );
  }
  if (rawLengths.rawTitleMinLength === null) {
    details.push(`collections.${collectionId}.titleMinLength must be an integer >= 1 when provided`);
  }
  if (rawLengths.rawTitleMaxLength === null) {
    details.push(`collections.${collectionId}.titleMaxLength must be an integer >= 1 when provided`);
  }
  return details;
}

function collectMismatchedLengthMessages(rawLengths, collectionId) {
  const details = [];
  if (
    Number.isInteger(rawLengths.rawPrimaryFieldMinLength) &&
    Number.isInteger(rawLengths.rawTitleMinLength) &&
    rawLengths.rawPrimaryFieldMinLength !== rawLengths.rawTitleMinLength
  ) {
    details.push(
      `collections.${collectionId}.primaryFieldMinLength and titleMinLength must match when both are provided`
    );
  }
  if (
    Number.isInteger(rawLengths.rawPrimaryFieldMaxLength) &&
    Number.isInteger(rawLengths.rawTitleMaxLength) &&
    rawLengths.rawPrimaryFieldMaxLength !== rawLengths.rawTitleMaxLength
  ) {
    details.push(
      `collections.${collectionId}.primaryFieldMaxLength and titleMaxLength must match when both are provided`
    );
  }
  return details;
}

function resolvePrimaryFieldLengths(rawLengths, configuredPrimaryField) {
  const primaryFieldMinLength = Number.isInteger(rawLengths.rawPrimaryFieldMinLength)
    ? rawLengths.rawPrimaryFieldMinLength
    : Number.isInteger(rawLengths.rawTitleMinLength)
      ? rawLengths.rawTitleMinLength
      : configuredPrimaryField === "title"
        ? 3
        : 1;
  const primaryFieldMaxLength = Number.isInteger(rawLengths.rawPrimaryFieldMaxLength)
    ? rawLengths.rawPrimaryFieldMaxLength
    : Number.isInteger(rawLengths.rawTitleMaxLength)
      ? rawLengths.rawTitleMaxLength
      : configuredPrimaryField === "title"
        ? 120
        : Math.max(120, primaryFieldMinLength);
  return {
    primaryFieldMinLength,
    primaryFieldMaxLength
  };
}

function resolveTitleLengths({
  titleField,
  rawLengths,
  configuredPrimaryField,
  primaryFieldMinLength,
  primaryFieldMaxLength
}) {
  const titleMinLength =
    Number.isInteger(titleField?.minLength) && titleField.minLength >= 0
      ? titleField.minLength
      : Number.isInteger(rawLengths.rawTitleMinLength)
        ? rawLengths.rawTitleMinLength
        : configuredPrimaryField === "title"
          ? primaryFieldMinLength
          : 3;
  const titleMaxLength =
    Number.isInteger(titleField?.maxLength) && titleField.maxLength >= titleMinLength
      ? titleField.maxLength
      : Number.isInteger(rawLengths.rawTitleMaxLength) &&
          rawLengths.rawTitleMaxLength >= titleMinLength
        ? rawLengths.rawTitleMaxLength
        : configuredPrimaryField === "title"
          ? Math.max(primaryFieldMaxLength, titleMinLength)
          : 120;
  return {
    titleMinLength,
    titleMaxLength
  };
}

function throwInvalidLengthConfiguration(collectionId, details) {
  const error = new Error(
    `Generated collection '${collectionId}' includes invalid length configuration`
  );
  error.code = "GENERATED_COLLECTION_CONFIG_INVALID";
  error.details = details;
  throw error;
}

function normalizeCollectionLengthConfiguration({
  rawCollection,
  collectionId,
  configuredPrimaryField,
  titleField
}) {
  const rawLengths = resolveRawLengthConfiguration(rawCollection);
  const lengthDetails = [
    ...collectInvalidLengthMessages(rawLengths, collectionId),
    ...collectMismatchedLengthMessages(rawLengths, collectionId)
  ];
  const { primaryFieldMinLength, primaryFieldMaxLength } = resolvePrimaryFieldLengths(
    rawLengths,
    configuredPrimaryField
  );
  if (primaryFieldMaxLength < primaryFieldMinLength) {
    lengthDetails.push(
      `collections.${collectionId}.primaryFieldMaxLength must be greater than or equal to primaryFieldMinLength`
    );
  }
  if (lengthDetails.length > 0) {
    throwInvalidLengthConfiguration(collectionId, lengthDetails);
  }
  const { titleMinLength, titleMaxLength } = resolveTitleLengths({
    titleField,
    rawLengths,
    configuredPrimaryField,
    primaryFieldMinLength,
    primaryFieldMaxLength
  });
  return {
    primaryFieldMinLength,
    primaryFieldMaxLength,
    titleMinLength,
    titleMaxLength
  };
}

export { normalizeCollectionLengthConfiguration };
