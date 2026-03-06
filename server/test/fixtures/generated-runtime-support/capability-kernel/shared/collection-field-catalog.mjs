import {
  hasCollectionFieldTypePlugin,
  listCollectionFieldTypePluginTypes,
  resolveCollectionFieldTypeQueryContract
} from "./collection-field-type-plugin-registry.mjs";

const CORE_COLLECTION_FIELD_TYPES = Object.freeze([
  "text",
  "number",
  "boolean",
  "enum",
  "enum-multi",
  "reference",
  "reference-multi",
  "computed"
]);
const PREFERRED_COLLECTION_FIELD_TYPE_ORDER = Object.freeze([
  "text",
  "url",
  "structured-object",
  "structured-object-array",
  "number",
  "boolean",
  "enum",
  "enum-multi",
  "date",
  "reference",
  "reference-multi",
  "computed"
]);
const REFERENCE_COLLECTION_FIELD_TYPES = Object.freeze(["reference", "reference-multi"]);
const MULTI_VALUE_COLLECTION_FIELD_TYPES = Object.freeze(["enum-multi", "reference-multi"]);
const COLLECTION_FIELD_ID_PATTERN = /^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)*(?:-[a-z0-9]+)*$/;
const COLLECTION_FIELD_ID_PATTERN_LABEL = "lowercase camelCase or kebab-case";

const CORE_COLLECTION_FIELD_TYPE_SET = new Set(CORE_COLLECTION_FIELD_TYPES);
const REFERENCE_COLLECTION_FIELD_TYPE_SET = new Set(REFERENCE_COLLECTION_FIELD_TYPES);
const MULTI_VALUE_COLLECTION_FIELD_TYPE_SET = new Set(MULTI_VALUE_COLLECTION_FIELD_TYPES);

function normalizeCollectionFieldType(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

function normalizeCollectionFieldId(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function listSupportedCollectionFieldTypes() {
  const pluginTypes = listCollectionFieldTypePluginTypes();
  const remainingTypes = new Set([...CORE_COLLECTION_FIELD_TYPES, ...pluginTypes]);
  const orderedTypes = [];

  for (const preferredType of PREFERRED_COLLECTION_FIELD_TYPE_ORDER) {
    if (!remainingTypes.has(preferredType)) {
      continue;
    }
    orderedTypes.push(preferredType);
    remainingTypes.delete(preferredType);
  }

  for (const pluginType of pluginTypes) {
    if (!remainingTypes.has(pluginType)) {
      continue;
    }
    orderedTypes.push(pluginType);
    remainingTypes.delete(pluginType);
  }

  for (const coreType of CORE_COLLECTION_FIELD_TYPES) {
    if (!remainingTypes.has(coreType)) {
      continue;
    }
    orderedTypes.push(coreType);
    remainingTypes.delete(coreType);
  }

  return orderedTypes;
}

function listSupportedCollectionFieldTypesLabel() {
  return listSupportedCollectionFieldTypes().join(", ");
}

function isSupportedCollectionFieldType(value) {
  const normalizedType = normalizeCollectionFieldType(value);
  if (normalizedType.length === 0) {
    return false;
  }

  return (
    CORE_COLLECTION_FIELD_TYPE_SET.has(normalizedType) ||
    hasCollectionFieldTypePlugin(normalizedType)
  );
}

function isCollectionFieldId(value) {
  return COLLECTION_FIELD_ID_PATTERN.test(normalizeCollectionFieldId(value));
}

function isReferenceCollectionFieldType(value) {
  return REFERENCE_COLLECTION_FIELD_TYPE_SET.has(normalizeCollectionFieldType(value));
}

function isMultiValueCollectionFieldType(value) {
  return MULTI_VALUE_COLLECTION_FIELD_TYPE_SET.has(normalizeCollectionFieldType(value));
}

function isMutableCollectionFieldType(value) {
  const normalizedType = normalizeCollectionFieldType(value);
  return normalizedType !== "computed" && isSupportedCollectionFieldType(normalizedType);
}

function isQueryableCollectionFieldType(value) {
  const normalizedType = normalizeCollectionFieldType(value);
  if (normalizedType.length === 0 || normalizedType === "computed") {
    return false;
  }

  if (CORE_COLLECTION_FIELD_TYPE_SET.has(normalizedType)) {
    return true;
  }

  if (!hasCollectionFieldTypePlugin(normalizedType)) {
    return false;
  }

  return resolveCollectionFieldTypeQueryContract(normalizedType).supported === true;
}

function listMutableCollectionFieldTypes() {
  return listSupportedCollectionFieldTypes().filter((type) => type !== "computed");
}

function listQueryableCollectionFieldTypes() {
  return listMutableCollectionFieldTypes();
}

const SUPPORTED_COLLECTION_FIELD_TYPES = Object.freeze(listSupportedCollectionFieldTypes());
const MUTABLE_COLLECTION_FIELD_TYPES = Object.freeze(listMutableCollectionFieldTypes());
const QUERYABLE_COLLECTION_FIELD_TYPES = Object.freeze(listQueryableCollectionFieldTypes());
const SUPPORTED_COLLECTION_FIELD_TYPE_SET = new Set(SUPPORTED_COLLECTION_FIELD_TYPES);
const MUTABLE_COLLECTION_FIELD_TYPE_SET = new Set(MUTABLE_COLLECTION_FIELD_TYPES);
const QUERYABLE_COLLECTION_FIELD_TYPE_SET = new Set(QUERYABLE_COLLECTION_FIELD_TYPES);
const SUPPORTED_COLLECTION_FIELD_TYPES_LABEL = listSupportedCollectionFieldTypesLabel();

export {
  COLLECTION_FIELD_ID_PATTERN,
  COLLECTION_FIELD_ID_PATTERN_LABEL,
  CORE_COLLECTION_FIELD_TYPE_SET,
  CORE_COLLECTION_FIELD_TYPES,
  MUTABLE_COLLECTION_FIELD_TYPE_SET,
  MUTABLE_COLLECTION_FIELD_TYPES,
  MULTI_VALUE_COLLECTION_FIELD_TYPE_SET,
  MULTI_VALUE_COLLECTION_FIELD_TYPES,
  QUERYABLE_COLLECTION_FIELD_TYPE_SET,
  QUERYABLE_COLLECTION_FIELD_TYPES,
  REFERENCE_COLLECTION_FIELD_TYPE_SET,
  REFERENCE_COLLECTION_FIELD_TYPES,
  SUPPORTED_COLLECTION_FIELD_TYPE_SET,
  SUPPORTED_COLLECTION_FIELD_TYPES,
  SUPPORTED_COLLECTION_FIELD_TYPES_LABEL,
  isCollectionFieldId,
  isMultiValueCollectionFieldType,
  isMutableCollectionFieldType,
  isQueryableCollectionFieldType,
  isReferenceCollectionFieldType,
  isSupportedCollectionFieldType,
  listMutableCollectionFieldTypes,
  listQueryableCollectionFieldTypes,
  listSupportedCollectionFieldTypes,
  listSupportedCollectionFieldTypesLabel,
  normalizeCollectionFieldId,
  normalizeCollectionFieldType
};
