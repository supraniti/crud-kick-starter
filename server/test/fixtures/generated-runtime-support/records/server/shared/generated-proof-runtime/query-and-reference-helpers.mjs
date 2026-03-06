import {
  isIsoDateString,
  normalizeBooleanValue,
  normalizeEnumValue,
  normalizeNumberValue,
  normalizeOptionalDate,
  normalizeReferenceId,
  normalizeReferenceIds,
  normalizeStringSet,
  normalizeTextValue
} from "./field-value-normalizers.mjs";
import {
  resolveCollectionFieldTypeQueryContract
} from "../../../shared/collection-field-type-plugin-registry.mjs";
import {
  resolveReferenceQueryKeys,
  resolveReferenceTitleKeys,
  resolveReferenceTitlesKeys
} from "../../../shared/reference-field-key-utils.mjs";

const DEFAULT_PAGE_LIMIT = 25;
const RESERVED_COLLECTION_QUERY_KEYS = new Set(["offset", "limit", "search"]);

function cloneJsonValue(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== "object") {
    return value;
  }

  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function parsePagination(value, fallback) {
  const parsed = Number.parseInt(`${value ?? ""}`, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function isRepository(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.readState === "function" &&
    typeof value.transact === "function"
  );
}

function rowsForCollection(snapshot, collectionId) {
  return Array.isArray(snapshot?.[collectionId]) ? snapshot[collectionId] : null;
}

function createReferenceLookup({
  referenceState,
  resolveCollectionRepository,
  resolveProviderValidationRows,
  workingState,
  primaryFieldByCollection
}) {
  const normalizedPrimaryFieldMap = new Map();
  if (primaryFieldByCollection instanceof Map) {
    for (const [collectionId, primaryField] of primaryFieldByCollection.entries()) {
      if (
        typeof collectionId === "string" &&
        collectionId.length > 0 &&
        typeof primaryField === "string" &&
        primaryField.length > 0
      ) {
        normalizedPrimaryFieldMap.set(collectionId, primaryField);
      }
    }
  } else if (primaryFieldByCollection && typeof primaryFieldByCollection === "object") {
    for (const [collectionId, primaryField] of Object.entries(primaryFieldByCollection)) {
      if (
        typeof collectionId === "string" &&
        collectionId.length > 0 &&
        typeof primaryField === "string" &&
        primaryField.length > 0
      ) {
        normalizedPrimaryFieldMap.set(collectionId, primaryField);
      }
    }
  }

  return {
    referenceState:
      referenceState && typeof referenceState === "object" ? referenceState : {},
    resolveCollectionRepository,
    resolveProviderValidationRows,
    workingState: workingState && typeof workingState === "object" ? workingState : null,
    primaryFieldByCollection: normalizedPrimaryFieldMap,
    rowsByCollection: new Map()
  };
}

async function readReferenceRows(referenceLookup, collectionId) {
  if (typeof collectionId !== "string" || collectionId.length === 0) {
    return [];
  }

  if (referenceLookup.rowsByCollection.has(collectionId)) {
    return referenceLookup.rowsByCollection.get(collectionId);
  }

  const rowsPromise = (async () => {
    if (typeof referenceLookup.resolveProviderValidationRows === "function") {
      const providerRows = await referenceLookup.resolveProviderValidationRows(collectionId);
      if (Array.isArray(providerRows)) {
        return providerRows;
      }
    }

    const workingRows = rowsForCollection(referenceLookup.workingState, collectionId);
    if (Array.isArray(workingRows) && workingRows.length > 0) {
      return workingRows;
    }

    const stateRows = rowsForCollection(referenceLookup.referenceState, collectionId);
    if (Array.isArray(stateRows) && stateRows.length > 0) {
      return stateRows;
    }

    let repositoryRows = null;
    if (typeof referenceLookup.resolveCollectionRepository === "function") {
      const repository = referenceLookup.resolveCollectionRepository(collectionId);
      if (isRepository(repository)) {
        const repositoryState = await repository.readState();
        repositoryRows = rowsForCollection(repositoryState, collectionId);
        if (Array.isArray(repositoryRows) && repositoryRows.length > 0) {
          return repositoryRows;
        }
      }
    }

    if (Array.isArray(repositoryRows)) {
      return repositoryRows;
    }
    if (Array.isArray(stateRows)) {
      return stateRows;
    }
    if (Array.isArray(workingRows)) {
      return workingRows;
    }

    return [];
  })();

  referenceLookup.rowsByCollection.set(collectionId, rowsPromise);
  return rowsPromise;
}

function resolveReferenceTitleFromRows(
  rows,
  referenceId,
  {
    labelField = null,
    primaryField = null
  } = {}
) {
  if (typeof referenceId !== "string" || referenceId.length === 0) {
    return null;
  }

  const target = rows.find((row) => row?.id === referenceId) ?? null;
  if (!target) {
    return null;
  }

  if (
    typeof labelField === "string" &&
    labelField.length > 0 &&
    typeof target[labelField] === "string" &&
    target[labelField].length > 0
  ) {
    return target[labelField];
  }

  if (
    typeof primaryField === "string" &&
    primaryField.length > 0 &&
    typeof target[primaryField] === "string" &&
    target[primaryField].length > 0
  ) {
    return target[primaryField];
  }
  if (typeof target.title === "string" && target.title.length > 0) {
    return target.title;
  }
  if (typeof target.label === "string" && target.label.length > 0) {
    return target.label;
  }
  return null;
}

async function resolveReferenceTitle(referenceLookup, collectionId, referenceId) {
  const referenceRows = await readReferenceRows(referenceLookup, collectionId);
  const primaryField =
    referenceLookup?.primaryFieldByCollection instanceof Map
      ? referenceLookup.primaryFieldByCollection.get(collectionId) ?? null
      : null;
  return resolveReferenceTitleFromRows(referenceRows, referenceId, {
    labelField: null,
    primaryField
  });
}

async function resolveReferenceTitles(
  referenceLookup,
  collectionId,
  referenceIds = [],
  {
    labelField = null
  } = {}
) {
  if (!Array.isArray(referenceIds) || referenceIds.length === 0) {
    return [];
  }

  const referenceRows = await readReferenceRows(referenceLookup, collectionId);
  const primaryField =
    referenceLookup?.primaryFieldByCollection instanceof Map
      ? referenceLookup.primaryFieldByCollection.get(collectionId) ?? null
      : null;
  const titles = [];
  for (const referenceId of referenceIds) {
    const resolved = resolveReferenceTitleFromRows(referenceRows, referenceId, {
      labelField,
      primaryField
    });
    titles.push(resolved ?? referenceId);
  }
  return titles;
}

function cloneMutableFieldValues(next, item, definition) {
  for (const fieldDescriptor of definition.mutableFieldDescriptors) {
    if (
      (fieldDescriptor.type === "enum-multi" || fieldDescriptor.type === "reference-multi") &&
      Array.isArray(item[fieldDescriptor.id])
    ) {
      next[fieldDescriptor.id] = [...item[fieldDescriptor.id]];
      continue;
    }

    if (
      (fieldDescriptor.type === "structured-object" ||
        fieldDescriptor.type === "structured-object-array") &&
      item[fieldDescriptor.id] &&
      typeof item[fieldDescriptor.id] === "object"
    ) {
      next[fieldDescriptor.id] = cloneJsonValue(item[fieldDescriptor.id]);
    }
  }
}

function resolveReferenceFieldLabelField(referenceField) {
  return typeof referenceField.labelField === "string" && referenceField.labelField.length > 0
    ? referenceField.labelField
    : null;
}

async function applyReferenceMultiTitles(next, item, referenceField, referenceLookup) {
  const referenceIds = Array.isArray(item?.[referenceField.id]) ? item[referenceField.id] : [];
  const resolvedTitles = await resolveReferenceTitles(
    referenceLookup,
    referenceField.collectionId,
    referenceIds,
    {
      labelField: resolveReferenceFieldLabelField(referenceField)
    }
  );
  for (const titlesKey of resolveReferenceTitlesKeys(referenceField.id)) {
    next[titlesKey] = [...resolvedTitles];
  }
}

async function applySingleReferenceTitle(next, item, referenceField, referenceLookup) {
  const referenceId = item?.[referenceField.id];
  const referenceRows = await readReferenceRows(referenceLookup, referenceField.collectionId);
  const primaryField =
    referenceLookup?.primaryFieldByCollection instanceof Map
      ? referenceLookup.primaryFieldByCollection.get(referenceField.collectionId) ?? null
      : null;
  const resolvedTitle = resolveReferenceTitleFromRows(referenceRows, referenceId, {
    labelField: resolveReferenceFieldLabelField(referenceField),
    primaryField
  });

  for (const titleKey of resolveReferenceTitleKeys(referenceField.id)) {
    next[titleKey] = resolvedTitle;
  }
  if (referenceField.id === "recordId") {
    next.recordTitle = resolvedTitle;
  }
}

async function resolveCollectionRow(item, definition, referenceLookup) {
  const next = {
    ...item,
    ...(Array.isArray(item.labels)
      ? {
          labels: [...item.labels]
        }
      : {})
  };

  cloneMutableFieldValues(next, item, definition);

  for (const referenceField of definition.referenceFieldDescriptors) {
    if (referenceField.type === "reference-multi") {
      await applyReferenceMultiTitles(next, item, referenceField, referenceLookup);
      continue;
    }

    await applySingleReferenceTitle(next, item, referenceField, referenceLookup);
  }

  return next;
}

function parseCsvIds(rawValue) {
  if (typeof rawValue !== "string" || rawValue.length === 0) {
    return [];
  }

  return normalizeStringSet(
    rawValue
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

function parseCsvReferenceIds(rawValue) {
  if (Array.isArray(rawValue)) {
    const parsed = normalizeReferenceIds(rawValue);
    return parsed === "__INVALID__" || parsed === undefined ? [] : parsed;
  }

  if (typeof rawValue !== "string" || rawValue.length === 0) {
    return [];
  }

  const parsed = normalizeReferenceIds(rawValue.split(",").map((item) => item.trim()));
  return parsed === "__INVALID__" || parsed === undefined ? [] : parsed;
}

function resolveFieldQueryKeys(fieldDescriptor = {}) {
  if (fieldDescriptor.type === "reference-multi") {
    return resolveReferenceQueryKeys(fieldDescriptor.id, {
      multi: true
    });
  }

  if (fieldDescriptor.type === "reference") {
    return resolveReferenceQueryKeys(fieldDescriptor.id, {
      multi: false
    });
  }

  return [fieldDescriptor.id];
}

function hasActiveQueryValue(rawValue) {
  if (rawValue === undefined || rawValue === null) {
    return false;
  }

  if (Array.isArray(rawValue)) {
    return rawValue.some((entry) => hasActiveQueryValue(entry));
  }

  if (typeof rawValue === "string") {
    return rawValue.trim().length > 0;
  }

  return true;
}

function resolveQueryKeyUsed(query, keys = []) {
  if (!query || typeof query !== "object") {
    return null;
  }

  for (const key of keys) {
    if (
      typeof key !== "string" ||
      key.length === 0 ||
      !Object.prototype.hasOwnProperty.call(query, key)
    ) {
      continue;
    }

    if (hasActiveQueryValue(query[key])) {
      return key;
    }
  }

  return null;
}

function collectQueryableFieldIds(definition = {}) {
  return new Set(
    (definition.queryFieldDescriptors ?? [])
      .map((fieldDescriptor) => fieldDescriptor?.id)
      .filter((fieldId) => typeof fieldId === "string" && fieldId.length > 0)
  );
}

function buildUnsupportedFieldFilterEntry(fieldDescriptor, queryKey) {
  const queryContract = resolveCollectionFieldTypeQueryContract(fieldDescriptor.type);
  const normalizedCodeSuffix =
    typeof queryContract?.codeSuffix === "string" && queryContract.codeSuffix.length > 0
      ? queryContract.codeSuffix
      : "FILTER_UNSUPPORTED";
  const normalizedMessage =
    typeof queryContract?.message === "string" && queryContract.message.length > 0
      ? queryContract.message
      : `Field '${fieldDescriptor.id}' does not support filtering`;

  return {
    fieldDescriptor,
    queryKey,
    codeSuffix: normalizedCodeSuffix,
    message: normalizedMessage
  };
}

function collectUnsupportedMutableFieldFilters(query = {}, definition = {}, queryableFieldIds) {
  const unsupported = [];
  for (const fieldDescriptor of definition.mutableFieldDescriptors ?? []) {
    if (
      !fieldDescriptor ||
      typeof fieldDescriptor.id !== "string" ||
      fieldDescriptor.id.length === 0 ||
      queryableFieldIds.has(fieldDescriptor.id)
    ) {
      continue;
    }

    const activeQueryKey = resolveQueryKeyUsed(query, resolveFieldQueryKeys(fieldDescriptor));
    if (!activeQueryKey) {
      continue;
    }

    unsupported.push(buildUnsupportedFieldFilterEntry(fieldDescriptor, activeQueryKey));
  }

  return unsupported;
}

function hasKnownMutableQueryKey(definition = {}, queryKey) {
  return (definition.mutableFieldDescriptors ?? []).some((fieldDescriptor) =>
    resolveFieldQueryKeys(fieldDescriptor).includes(queryKey)
  );
}

function collectUnsupportedUnknownQueryFilters(query = {}, definition = {}) {
  const unsupported = [];
  if (!query || typeof query !== "object") {
    return unsupported;
  }

  for (const rawKey of Object.keys(query)) {
    if (
      typeof rawKey !== "string" ||
      rawKey.length === 0 ||
      RESERVED_COLLECTION_QUERY_KEYS.has(rawKey) ||
      hasKnownMutableQueryKey(definition, rawKey) ||
      !hasActiveQueryValue(query[rawKey])
    ) {
      continue;
    }

    unsupported.push({
      fieldDescriptor: {
        id: rawKey,
        type: "unknown"
      },
      queryKey: rawKey,
      codeSuffix: "FILTER_UNSUPPORTED",
      message: `Filter '${rawKey}' is not supported`
    });
  }

  return unsupported;
}

function collectUnsupportedFieldFilters(query = {}, definition = {}) {
  const queryableFieldIds = collectQueryableFieldIds(definition);
  return [
    ...collectUnsupportedMutableFieldFilters(query, definition, queryableFieldIds),
    ...collectUnsupportedUnknownQueryFilters(query, definition)
  ];
}

function defaultQueryFieldValue(fieldDescriptor) {
  return fieldDescriptor.type === "enum-multi" || fieldDescriptor.type === "reference-multi"
    ? []
    : "";
}

function parseEnumMultiQueryFieldValue(rawQueryValue, fieldDescriptor) {
  const values = parseCsvIds(rawQueryValue);
  const filtered =
    fieldDescriptor.optionSet?.size > 0
      ? values.filter((value) => fieldDescriptor.optionSet.has(value))
      : values;
  return {
    active: filtered.length > 0,
    value: filtered
  };
}

function parseReferenceMultiQueryFieldValue(rawQueryValue) {
  const values = parseCsvReferenceIds(rawQueryValue);
  return {
    active: values.length > 0,
    value: values
  };
}

function parseEnumQueryFieldValue(rawQueryValue, fieldDescriptor) {
  const normalized = normalizeEnumValue(rawQueryValue);
  const value =
    fieldDescriptor.optionSet?.size > 0 && fieldDescriptor.optionSet.has(normalized)
      ? normalized
      : "";
  return {
    active: value.length > 0,
    value
  };
}

function parseReferenceQueryFieldValue(rawQueryValue) {
  const normalized = normalizeReferenceId(rawQueryValue);
  const value = normalized === "__INVALID__" || normalized === null ? "" : normalized;
  return {
    active: value.length > 0,
    value
  };
}

function parseDateQueryFieldValue(rawQueryValue) {
  const normalized = normalizeOptionalDate(rawQueryValue);
  const value =
    normalized === "__INVALID__" || normalized === null || !isIsoDateString(normalized)
      ? ""
      : normalized;
  return {
    active: value.length > 0,
    value
  };
}

function parseNumberQueryFieldValue(rawQueryValue) {
  const normalized = normalizeNumberValue(rawQueryValue);
  const value = normalized === "__INVALID__" || normalized === null ? "" : normalized;
  return {
    active: value !== "",
    value
  };
}

function parseBooleanQueryFieldValue(rawQueryValue) {
  const normalized = normalizeBooleanValue(rawQueryValue);
  const value = normalized === "__INVALID__" || normalized === null ? "" : normalized;
  return {
    active: value !== "",
    value
  };
}

function parseTextQueryFieldValue(rawQueryValue) {
  const value = normalizeTextValue(rawQueryValue).toLowerCase();
  return {
    active: value.length > 0,
    value
  };
}

const QUERY_FIELD_VALUE_PARSERS = {
  "enum-multi": parseEnumMultiQueryFieldValue,
  "reference-multi": parseReferenceMultiQueryFieldValue,
  enum: parseEnumQueryFieldValue,
  reference: parseReferenceQueryFieldValue,
  date: parseDateQueryFieldValue,
  number: parseNumberQueryFieldValue,
  boolean: parseBooleanQueryFieldValue
};

function parseQueryFieldValue(rawQueryValue, fieldDescriptor) {
  if (rawQueryValue === undefined || rawQueryValue === null) {
    return {
      active: false,
      value: defaultQueryFieldValue(fieldDescriptor)
    };
  }

  const parser = QUERY_FIELD_VALUE_PARSERS[fieldDescriptor.type] ?? parseTextQueryFieldValue;
  return parser(rawQueryValue, fieldDescriptor);
}

function resolveQueryValueByKeys(query, keys = []) {
  if (!query || typeof query !== "object") {
    return undefined;
  }

  for (const key of keys) {
    if (
      typeof key === "string" &&
      key.length > 0 &&
      Object.prototype.hasOwnProperty.call(query, key) &&
      query[key] !== undefined
    ) {
      return query[key];
    }
  }

  return undefined;
}

function parseCollectionQuery(query = {}, definition) {
  const offset = parsePagination(query.offset, 0);
  const limit = Math.max(1, Math.min(parsePagination(query.limit, DEFAULT_PAGE_LIMIT), 200));
  const search = typeof query.search === "string" ? query.search.trim().toLowerCase() : "";
  const filters = {
    search
  };
  const activeFieldFilters = [];
  const unsupportedFieldFilters = collectUnsupportedFieldFilters(query, definition);

  for (const fieldDescriptor of definition.queryFieldDescriptors) {
    const queryKeys =
      fieldDescriptor.type === "reference-multi"
        ? resolveReferenceQueryKeys(fieldDescriptor.id, {
            multi: true
          })
        : fieldDescriptor.type === "reference"
          ? resolveReferenceQueryKeys(fieldDescriptor.id, {
              multi: false
            })
          : [fieldDescriptor.id];
    const queryValue = resolveQueryValueByKeys(query, queryKeys);
    const parsed = parseQueryFieldValue(queryValue, fieldDescriptor);
    filters[fieldDescriptor.id] = parsed.value;
    if (parsed.active) {
      activeFieldFilters.push({
        fieldDescriptor,
        value: parsed.value
      });
    }
  }

  return {
    offset,
    limit,
    search,
    filters,
    activeFieldFilters,
    unsupportedFieldFilters
  };
}

export {
  createReferenceLookup,
  isRepository,
  parseCollectionQuery,
  readReferenceRows,
  resolveCollectionRow
};
