import { COLLECTION_PAGE_LIMIT } from "./00-constants.js";
import {
  resolveEditableCollectionFields,
  resolveCollectionFilterFieldConfigs,
  cloneJsonValue
} from "./01-schema-and-filter-config.js";
import {
  resolveCollectionFieldTypePlugin
} from "../../../../runtime/shared-capability-bridges/collection-field-type-plugin-registry.mjs";
import {
  defaultStructuredObjectValue,
  resolveStructuredObjectArrayConstraintsFromDescriptor,
  resolveStructuredObjectSchemaFromDescriptor
} from "../../../../runtime/shared-capability-bridges/structured-field-runtime.mjs";

function normalizeOptionalDate(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeArrayValue(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((item) => typeof item === "string" && item.length > 0))];
}

function resolvePluginEditorVariant(field = {}) {
  const fieldType = typeof field?.type === "string" ? field.type : "";
  if (fieldType.length === 0) {
    return "";
  }

  const typePlugin = resolveCollectionFieldTypePlugin(fieldType);
  const variant = typePlugin?.frontend?.editor?.variant;
  return typeof variant === "string" ? variant : "";
}

function isStructuredObjectLikeField(field = {}) {
  if (field?.type === "structured-object") {
    return true;
  }

  return resolvePluginEditorVariant(field) === "structured-object";
}

function isStructuredObjectArrayLikeField(field = {}) {
  if (field?.type === "structured-object-array") {
    return true;
  }

  return resolvePluginEditorVariant(field) === "structured-object-array";
}

function resolveNumberFieldDefault(field, fieldDefault) {
  if (typeof fieldDefault === "number" && Number.isFinite(fieldDefault)) {
    return `${fieldDefault}`;
  }
  if (typeof field.min === "number") {
    return `${field.min}`;
  }
  return "0";
}

function resolveEnumFieldDefault(field, fieldDefault) {
  if (typeof fieldDefault === "string" && fieldDefault.length > 0) {
    return fieldDefault;
  }
  return field.options[0]?.value ?? "";
}

function resolveStructuredObjectFieldDefault(field, fieldDefault) {
  if (fieldDefault && typeof fieldDefault === "object" && !Array.isArray(fieldDefault)) {
    return cloneJsonValue(fieldDefault);
  }

  const objectSchema = resolveStructuredObjectSchemaFromDescriptor(field, {
    strict: false
  });
  return defaultStructuredObjectValue(
    objectSchema.ok ? objectSchema.value : {
      properties: []
    }
  );
}

function resolveStructuredObjectArrayFieldDefault(fieldDefault) {
  if (Array.isArray(fieldDefault)) {
    return cloneJsonValue(fieldDefault);
  }
  return [];
}

function resolveDateReferenceFieldDefault(fieldDefault) {
  return typeof fieldDefault === "string" ? fieldDefault : "";
}

function resolveStringFieldDefault(fieldDefault) {
  return typeof fieldDefault === "string" ? fieldDefault : "";
}

const FIELD_DEFAULT_RESOLVERS = Object.freeze({
  boolean: (_, fieldDefault) => fieldDefault === true,
  number: resolveNumberFieldDefault,
  enum: resolveEnumFieldDefault,
  "enum-multi": (_, fieldDefault) =>
    Array.isArray(fieldDefault) ? normalizeArrayValue(fieldDefault) : [],
  "reference-multi": (_, fieldDefault) =>
    Array.isArray(fieldDefault) ? normalizeArrayValue(fieldDefault) : [],
  date: (_, fieldDefault) => resolveDateReferenceFieldDefault(fieldDefault),
  reference: (_, fieldDefault) => resolveDateReferenceFieldDefault(fieldDefault)
});

function defaultFormValue(field) {
  const fieldDefault = field.default;
  const resolver = FIELD_DEFAULT_RESOLVERS[field.type];
  if (typeof resolver === "function") {
    return resolver(field, fieldDefault);
  }

  if (isStructuredObjectLikeField(field)) {
    return resolveStructuredObjectFieldDefault(field, fieldDefault);
  }

  if (isStructuredObjectArrayLikeField(field)) {
    return resolveStructuredObjectArrayFieldDefault(fieldDefault);
  }

  return resolveStringFieldDefault(fieldDefault);
}

function createDefaultCollectionFilterState(collectionId, collectionSchema = null) {
  const filterState = {
    search: ""
  };
  for (const fieldConfig of resolveCollectionFilterFieldConfigs(
    collectionSchema,
    collectionId
  )) {
    filterState[fieldConfig.fieldId] = fieldConfig.multi ? [] : "";
  }
  return filterState;
}

function createDefaultCollectionFormState(collectionId, collectionSchema = null) {
  const base = {
    itemId: null,
    saving: false,
    errorMessage: null,
    successMessage: null,
    errorActions: []
  };

  for (const field of resolveEditableCollectionFields(collectionSchema, collectionId)) {
    base[field.id] = defaultFormValue(field);
  }

  return base;
}

function normalizePayloadValue(field, rawValue) {
  if (field.type === "boolean") {
    return rawValue === true;
  }

  if (field.type === "number") {
    return Number.parseInt(`${rawValue ?? ""}`, 10);
  }

  if (field.type === "enum-multi" || field.type === "reference-multi") {
    return normalizeArrayValue(rawValue);
  }

  if (isStructuredObjectLikeField(field)) {
    if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
      const objectSchema = resolveStructuredObjectSchemaFromDescriptor(field, {
        strict: false
      });
      return defaultStructuredObjectValue(
        objectSchema.ok ? objectSchema.value : {
          properties: []
        }
      );
    }
    return cloneJsonValue(rawValue);
  }

  if (isStructuredObjectArrayLikeField(field)) {
    if (!Array.isArray(rawValue)) {
      return [];
    }
    const constraints = resolveStructuredObjectArrayConstraintsFromDescriptor(field, {
      strict: false
    });
    const propertyIds = new Set(
      (constraints.ok ? constraints.value.itemSchema.properties : [])
        .map((property) => property?.id)
        .filter((propertyId) => typeof propertyId === "string" && propertyId.length > 0)
    );
    return rawValue
      .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
      .map((entry) => {
        const normalizedEntry = {};
        for (const [key, value] of Object.entries(entry)) {
          if (propertyIds.size > 0 && !propertyIds.has(key)) {
            continue;
          }
          normalizedEntry[key] = value;
        }
        return normalizedEntry;
      });
  }

  if (field.type === "date" || field.type === "reference") {
    return normalizeOptionalDate(`${rawValue ?? ""}`);
  }

  return typeof rawValue === "string" ? rawValue : `${rawValue ?? ""}`;
}

function buildCollectionMutationPayload(collectionId, formState, collectionSchema = null) {
  const payload = {};
  for (const field of resolveEditableCollectionFields(collectionSchema, collectionId)) {
    payload[field.id] = normalizePayloadValue(field, formState[field.id]);
  }
  return payload;
}

function buildCollectionListOptions(collectionId, filterState, collectionSchema = null) {
  const options = {
    collectionId,
    offset: 0,
    limit: COLLECTION_PAGE_LIMIT,
    search: typeof filterState.search === "string" ? filterState.search : ""
  };

  for (const fieldConfig of resolveCollectionFilterFieldConfigs(
    collectionSchema,
    collectionId
  )) {
    if (fieldConfig.multi) {
      options[fieldConfig.queryKey] = normalizeArrayValue(filterState[fieldConfig.fieldId]);
      continue;
    }
    options[fieldConfig.queryKey] =
      typeof filterState[fieldConfig.fieldId] === "string"
        ? filterState[fieldConfig.fieldId]
        : "";
  }

  return options;
}

function buildEditCollectionFormState(collectionId, item, collectionSchema = null) {
  const formState = createDefaultCollectionFormState(collectionId, collectionSchema);
  formState.itemId = item.id;

  for (const field of resolveEditableCollectionFields(collectionSchema, collectionId)) {
    const value = item[field.id];
    if (field.type === "boolean") {
      formState[field.id] = value === true;
      continue;
    }
    if (field.type === "number") {
      formState[field.id] = `${value ?? ""}`;
      continue;
    }
    if (field.type === "enum-multi" || field.type === "reference-multi") {
      formState[field.id] = normalizeArrayValue(value);
      continue;
    }
    if (isStructuredObjectLikeField(field)) {
      formState[field.id] =
        value && typeof value === "object" && !Array.isArray(value)
          ? cloneJsonValue(value)
          : defaultFormValue(field);
      continue;
    }
    if (isStructuredObjectArrayLikeField(field)) {
      formState[field.id] = Array.isArray(value) ? cloneJsonValue(value) : [];
      continue;
    }
    if (field.type === "date" || field.type === "reference") {
      formState[field.id] = value ?? "";
      continue;
    }
    formState[field.id] = typeof value === "string" ? value : "";
  }

  formState.saving = false;
  formState.errorMessage = null;
  formState.successMessage = null;
  formState.errorActions = [];
  return formState;
}

export {
  buildCollectionListOptions,
  buildCollectionMutationPayload,
  buildEditCollectionFormState,
  createDefaultCollectionFilterState,
  createDefaultCollectionFormState
};
