const REFERENCE_SINGLE_CAMEL_SUFFIX = "Id";
const REFERENCE_MULTI_CAMEL_SUFFIX = "Ids";
const REFERENCE_SINGLE_KEBAB_SUFFIX = "-id";
const REFERENCE_MULTI_KEBAB_SUFFIX = "-ids";

function pushUnique(values, value) {
  if (typeof value !== "string" || value.length === 0) {
    return;
  }
  if (!values.includes(value)) {
    values.push(value);
  }
}

function normalizeReferenceFieldId(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function resolveReferenceFieldNamingStyle(fieldId) {
  return fieldId.includes("-") ? "kebab" : "camel";
}

function toKebabCaseAlias(value) {
  return `${value}`
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
}

function toCamelCaseAlias(value) {
  return `${value}`
    .toLowerCase()
    .replace(/-([a-z0-9])/g, (_, token) => token.toUpperCase());
}

function stripReferenceSingleSuffix(fieldId) {
  const normalizedFieldId = normalizeReferenceFieldId(fieldId);

  if (
    normalizedFieldId.endsWith(REFERENCE_SINGLE_KEBAB_SUFFIX) &&
    normalizedFieldId.length > REFERENCE_SINGLE_KEBAB_SUFFIX.length
  ) {
    return normalizedFieldId.slice(0, -REFERENCE_SINGLE_KEBAB_SUFFIX.length);
  }

  if (
    normalizedFieldId.endsWith(REFERENCE_SINGLE_CAMEL_SUFFIX) &&
    normalizedFieldId.length > REFERENCE_SINGLE_CAMEL_SUFFIX.length
  ) {
    return normalizedFieldId.slice(0, -REFERENCE_SINGLE_CAMEL_SUFFIX.length);
  }

  return normalizedFieldId;
}

function stripReferenceMultiSuffix(fieldId) {
  const normalizedFieldId = normalizeReferenceFieldId(fieldId);

  if (
    normalizedFieldId.endsWith(REFERENCE_MULTI_KEBAB_SUFFIX) &&
    normalizedFieldId.length > REFERENCE_MULTI_KEBAB_SUFFIX.length
  ) {
    return normalizedFieldId.slice(0, -REFERENCE_MULTI_KEBAB_SUFFIX.length);
  }

  if (
    normalizedFieldId.endsWith(REFERENCE_MULTI_CAMEL_SUFFIX) &&
    normalizedFieldId.length > REFERENCE_MULTI_CAMEL_SUFFIX.length
  ) {
    return normalizedFieldId.slice(0, -REFERENCE_MULTI_CAMEL_SUFFIX.length);
  }

  return normalizedFieldId;
}

function toReferenceTitleKey(fieldId) {
  const normalizedFieldId = normalizeReferenceFieldId(fieldId);
  const titleSuffix =
    resolveReferenceFieldNamingStyle(normalizedFieldId) === "kebab" ? "-title" : "Title";
  return `${stripReferenceSingleSuffix(normalizedFieldId)}${titleSuffix}`;
}

function toReferenceTitleCompatibilityKey(fieldId) {
  const normalizedFieldId = normalizeReferenceFieldId(fieldId);
  return normalizedFieldId.length > 0 ? `${normalizedFieldId}Title` : "";
}

function resolveReferenceTitleKeys(fieldId) {
  const keys = [];
  pushUnique(keys, toReferenceTitleKey(fieldId));
  pushUnique(keys, toReferenceTitleCompatibilityKey(fieldId));
  return keys;
}

function toReferenceTitlesKey(fieldId) {
  const normalizedFieldId = normalizeReferenceFieldId(fieldId);
  const titlesSuffix =
    resolveReferenceFieldNamingStyle(normalizedFieldId) === "kebab" ? "-titles" : "Titles";
  return `${stripReferenceMultiSuffix(normalizedFieldId)}${titlesSuffix}`;
}

function toReferenceTitlesCompatibilityKey(fieldId) {
  const normalizedFieldId = normalizeReferenceFieldId(fieldId);
  return normalizedFieldId.length > 0 ? `${normalizedFieldId}Titles` : "";
}

function resolveReferenceTitlesKeys(fieldId) {
  const keys = [];
  pushUnique(keys, toReferenceTitlesKey(fieldId));
  pushUnique(keys, toReferenceTitlesCompatibilityKey(fieldId));
  return keys;
}

function toReferenceMultiQueryKey(fieldId) {
  const normalizedFieldId = normalizeReferenceFieldId(fieldId);

  if (
    normalizedFieldId.endsWith(REFERENCE_SINGLE_KEBAB_SUFFIX) &&
    normalizedFieldId.length > REFERENCE_SINGLE_KEBAB_SUFFIX.length
  ) {
    return normalizedFieldId;
  }

  if (
    normalizedFieldId.endsWith(REFERENCE_MULTI_CAMEL_SUFFIX) &&
    normalizedFieldId.length > REFERENCE_MULTI_CAMEL_SUFFIX.length
  ) {
    return normalizedFieldId.slice(0, -1);
  }

  if (
    normalizedFieldId.endsWith(REFERENCE_MULTI_KEBAB_SUFFIX) &&
    normalizedFieldId.length > REFERENCE_MULTI_KEBAB_SUFFIX.length
  ) {
    return normalizedFieldId.slice(0, -1);
  }

  return normalizedFieldId;
}

function resolveReferenceQueryKeys(fieldId, options = {}) {
  const normalizedFieldId = normalizeReferenceFieldId(fieldId);
  if (normalizedFieldId.length === 0) {
    return [];
  }

  const multi = options.multi === true;
  const keys = [];
  pushUnique(keys, normalizedFieldId);
  if (multi) {
    pushUnique(keys, toReferenceMultiQueryKey(normalizedFieldId));
  }

  if (normalizedFieldId.includes("-")) {
    const camelAlias = toCamelCaseAlias(normalizedFieldId);
    pushUnique(keys, camelAlias);
    if (multi) {
      pushUnique(keys, toReferenceMultiQueryKey(camelAlias));
    }
  } else {
    const kebabAlias = toKebabCaseAlias(normalizedFieldId);
    pushUnique(keys, kebabAlias);
    if (multi) {
      pushUnique(keys, toReferenceMultiQueryKey(kebabAlias));
    }
  }

  return keys;
}

export {
  normalizeReferenceFieldId,
  resolveReferenceFieldNamingStyle,
  resolveReferenceQueryKeys,
  resolveReferenceTitleKeys,
  resolveReferenceTitlesKeys,
  stripReferenceSingleSuffix,
  stripReferenceMultiSuffix,
  toReferenceMultiQueryKey,
  toReferenceTitleCompatibilityKey,
  toReferenceTitleKey,
  toReferenceTitlesCompatibilityKey,
  toReferenceTitlesKey
};
