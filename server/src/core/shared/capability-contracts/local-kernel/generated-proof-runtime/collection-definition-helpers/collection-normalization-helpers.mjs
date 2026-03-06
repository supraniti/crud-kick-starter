import {
  legacySingularFromValue,
  normalizeIdPrefixSeed,
  normalizeSetValues,
  singularFromValue,
  toCodeToken,
  toKebabCase,
  toTitleCase
} from "../shared-utils.mjs";
import {
  DEFAULT_REFERENCE_COLLECTION_ID,
  MUTABLE_SUPPORTED_FIELD_TYPES,
  QUERY_SUPPORTED_FIELD_TYPES,
  dedupeFieldDescriptors,
  normalizeManifestFieldDescriptors,
  resolveComputedResolverToken
} from "./field-descriptor-helpers.mjs";
import { normalizeCollectionBehavior } from "./collection-behavior-normalization-helpers.mjs";
import { normalizeCollectionLengthConfiguration } from "./collection-length-normalization-helpers.mjs";

const DEFAULT_STATUSES = Object.freeze(["draft", "review", "published"]);
const DEFAULT_CATEGORIES = Object.freeze(["news", "guide", "ops"]);
const DEFAULT_LABELS = Object.freeze(["featured", "engineering", "release"]);
const DEFAULT_PRIMARY_FIELD = "title";

function resolveCollectionBehaviorInput(rawCollection, manifestCollection) {
  const rawBehavior = rawCollection?.behavior;
  const manifestBehavior = manifestCollection?.behavior;

  if (rawBehavior === undefined || rawBehavior === null) {
    return manifestBehavior;
  }

  if (!rawBehavior || typeof rawBehavior !== "object" || Array.isArray(rawBehavior)) {
    return rawBehavior;
  }

  if (
    manifestBehavior &&
    typeof manifestBehavior === "object" &&
    !Array.isArray(manifestBehavior)
  ) {
    return {
      ...manifestBehavior,
      ...rawBehavior
    };
  }

  return rawBehavior;
}

function resolveCollectionId(rawCollection, index) {
  const collectionId =
    typeof rawCollection?.collectionId === "string"
      ? rawCollection.collectionId.trim()
      : "";
  if (collectionId.length === 0) {
    const error = new Error(
      `Generated collection definition at index ${index} requires a non-empty collectionId`
    );
    error.code = "GENERATED_COLLECTION_CONFIG_INVALID";
    throw error;
  }

  return collectionId;
}

function resolveCollectionIdentity(rawCollection, collectionId) {
  const entitySingularSeed =
    typeof rawCollection?.entitySingular === "string" &&
    rawCollection.entitySingular.trim().length > 0
      ? rawCollection.entitySingular.trim()
      : singularFromValue(collectionId);
  const entitySingular = toKebabCase(entitySingularSeed);
  const entityTitle = toTitleCase(entitySingular);
  const entityCode = toCodeToken(entitySingular);
  return {
    entitySingular,
    entityTitle,
    entityCode
  };
}

function resolveCollectionIdPrefix(rawCollection, collectionId) {
  const idPrefixSeed =
    typeof rawCollection?.idPrefix === "string" && rawCollection.idPrefix.trim().length > 0
      ? rawCollection.idPrefix.trim().toLowerCase()
      : normalizeIdPrefixSeed(collectionId);

  if (!/^[a-z][a-z0-9]{1,7}$/.test(idPrefixSeed)) {
    const error = new Error(
      `Generated collection '${collectionId}' idPrefix '${idPrefixSeed}' is invalid`
    );
    error.code = "GENERATED_COLLECTION_CONFIG_INVALID";
    throw error;
  }

  return idPrefixSeed;
}

function resolveCollectionSequenceKeys(collectionId, entityTitle) {
  const entityPascal = entityTitle.replace(/[^A-Za-z0-9]/g, "");
  const sequenceKey = `next${entityPascal}Number`;
  const legacyEntitySingular = toKebabCase(legacySingularFromValue(collectionId));
  const legacyEntityPascal = toTitleCase(legacyEntitySingular).replace(/[^A-Za-z0-9]/g, "");
  const legacySequenceKey =
    legacyEntityPascal.length > 0 ? `next${legacyEntityPascal}Number` : sequenceKey;
  const sequenceKeyAliases =
    legacySequenceKey !== sequenceKey ? [legacySequenceKey] : [];
  return {
    sequenceKey,
    sequenceKeyAliases
  };
}

function resolveConfiguredPrimaryField(rawCollection, manifestCollection) {
  const manifestPrimaryField =
    typeof manifestCollection?.primaryField === "string" &&
    manifestCollection.primaryField.trim().length > 0
      ? manifestCollection.primaryField.trim()
      : "";
  const collectionPrimaryField =
    typeof rawCollection?.primaryField === "string" &&
    rawCollection.primaryField.trim().length > 0
      ? rawCollection.primaryField.trim()
      : "";
  return manifestPrimaryField || collectionPrimaryField || DEFAULT_PRIMARY_FIELD;
}

function hasUnsupportedFieldConfiguration(parsedManifestFields, parsedCollectionFieldDescriptors) {
  return (
    parsedManifestFields.unsupportedTypes.length > 0 ||
    parsedManifestFields.unsupportedComputedResolvers.length > 0 ||
    parsedManifestFields.unsupportedComputedResolverSettings.length > 0 ||
    parsedManifestFields.unsupportedDefaultValues.length > 0 ||
    parsedCollectionFieldDescriptors.unsupportedTypes.length > 0 ||
    parsedCollectionFieldDescriptors.unsupportedComputedResolvers.length > 0 ||
    parsedCollectionFieldDescriptors.unsupportedComputedResolverSettings.length > 0 ||
    parsedCollectionFieldDescriptors.unsupportedDefaultValues.length > 0
  );
}

function buildUnsupportedFieldConfigurationDetails(
  collectionId,
  parsedManifestFields,
  parsedCollectionFieldDescriptors
) {
  return [
    ...parsedManifestFields.unsupportedTypes.map(
      (field) =>
        `collections.${collectionId}.fields[${field.index}] '${field.id}' uses unsupported type '${field.type}'`
    ),
    ...parsedManifestFields.unsupportedComputedResolvers.map(
      (field) =>
        `collections.${collectionId}.fields[${field.index}] '${field.id}' uses unsupported computed resolver '${field.resolver}'`
    ),
    ...parsedManifestFields.unsupportedComputedResolverSettings.map(
      (field) =>
        `collections.${collectionId}.fields[${field.index}] '${field.id}' has invalid computed settings: ${field.reason}`
    ),
    ...parsedManifestFields.unsupportedDefaultValues.map(
      (field) =>
        `collections.${collectionId}.fields[${field.index}] '${field.id}' has invalid defaultValue: ${field.reason}`
    ),
    ...parsedCollectionFieldDescriptors.unsupportedTypes.map(
      (field) =>
        `collections.${collectionId}.fieldDescriptors[${field.index}] '${field.id}' uses unsupported type '${field.type}'`
    ),
    ...parsedCollectionFieldDescriptors.unsupportedComputedResolvers.map(
      (field) =>
        `collections.${collectionId}.fieldDescriptors[${field.index}] '${field.id}' uses unsupported computed resolver '${field.resolver}'`
    ),
    ...parsedCollectionFieldDescriptors.unsupportedComputedResolverSettings.map(
      (field) =>
        `collections.${collectionId}.fieldDescriptors[${field.index}] '${field.id}' has invalid computed settings: ${field.reason}`
    ),
    ...parsedCollectionFieldDescriptors.unsupportedDefaultValues.map(
      (field) =>
        `collections.${collectionId}.fieldDescriptors[${field.index}] '${field.id}' has invalid defaultValue: ${field.reason}`
    )
  ];
}

function parseCollectionFieldDescriptors(rawCollection, manifestCollection, collectionId) {
  const parsedManifestFields = normalizeManifestFieldDescriptors(manifestCollection);
  const manifestFieldDescriptors = parsedManifestFields.descriptors;
  const parsedCollectionFieldDescriptors = normalizeManifestFieldDescriptors({
    fields: Array.isArray(rawCollection?.fieldDescriptors) ? rawCollection.fieldDescriptors : []
  });
  const collectionFieldDescriptors = parsedCollectionFieldDescriptors.descriptors;
  if (hasUnsupportedFieldConfiguration(parsedManifestFields, parsedCollectionFieldDescriptors)) {
    const error = new Error(
      `Generated collection '${collectionId}' includes unsupported field configuration`
    );
    error.code = "GENERATED_COLLECTION_FIELD_TYPE_UNSUPPORTED";
    error.details = buildUnsupportedFieldConfigurationDetails(
      collectionId,
      parsedManifestFields,
      parsedCollectionFieldDescriptors
    );
    throw error;
  }

  return {
    manifestFieldDescriptors,
    collectionFieldDescriptors
  };
}

function resolveDescriptorSourceFieldMap(manifestFieldDescriptors, collectionFieldDescriptors) {
  const descriptorSourceFields =
    manifestFieldDescriptors.length > 0 ? manifestFieldDescriptors : collectionFieldDescriptors;
  return new Map(descriptorSourceFields.map((field) => [field.id, field]));
}

function resolveCollectionSetValues(rawCollection, descriptorSourceFieldMap) {
  const statusField = descriptorSourceFieldMap.get("status");
  const categoryField = descriptorSourceFieldMap.get("category");
  const labelsField = descriptorSourceFieldMap.get("labels");
  const statuses =
    Array.isArray(rawCollection?.statuses) && rawCollection.statuses.length > 0
      ? normalizeSetValues(rawCollection.statuses, DEFAULT_STATUSES)
      : statusField?.type === "enum" && Array.isArray(statusField.options)
        ? normalizeSetValues(statusField.options, DEFAULT_STATUSES)
        : normalizeSetValues(undefined, DEFAULT_STATUSES);

  const categories =
    Array.isArray(rawCollection?.categories) && rawCollection.categories.length > 0
      ? normalizeSetValues(rawCollection.categories, DEFAULT_CATEGORIES)
      : categoryField?.type === "enum" && Array.isArray(categoryField.options)
        ? normalizeSetValues(categoryField.options, DEFAULT_CATEGORIES)
        : normalizeSetValues(undefined, DEFAULT_CATEGORIES);

  const labels =
    Array.isArray(rawCollection?.labels) && rawCollection.labels.length > 0
      ? normalizeSetValues(rawCollection.labels, DEFAULT_LABELS)
      : labelsField?.type === "enum-multi" && Array.isArray(labelsField.options)
        ? normalizeSetValues(labelsField.options, DEFAULT_LABELS)
        : normalizeSetValues(undefined, DEFAULT_LABELS);

  return {
    statuses,
    categories,
    labels
  };
}

function resolveReferenceCollectionConfiguration(rawCollection, descriptorSourceFieldMap) {
  const referenceField = descriptorSourceFieldMap.get("recordId");
  const includeComputedSlug = rawCollection?.includeComputedSlug !== false;
  const referenceCollectionId =
    referenceField?.type === "reference" &&
    typeof referenceField.collectionId === "string" &&
    referenceField.collectionId.length > 0
      ? referenceField.collectionId
      : typeof rawCollection?.referenceCollectionId === "string" &&
          rawCollection.referenceCollectionId.trim().length > 0
        ? rawCollection.referenceCollectionId.trim().toLowerCase()
        : DEFAULT_REFERENCE_COLLECTION_ID;
  const referenceEntityTitle = toTitleCase(singularFromValue(referenceCollectionId));
  return {
    includeComputedSlug,
    referenceCollectionId,
    referenceEntityTitle
  };
}

function buildFallbackFieldDescriptors({
  titleMinLength,
  titleMaxLength,
  statuses,
  categories,
  labels,
  referenceCollectionId,
  includeComputedSlug
}) {
  const fallbackFieldDescriptors = [
    {
      id: "title",
      type: "text",
      required: true,
      minLength: titleMinLength,
      maxLength: titleMaxLength
    },
    {
      id: "status",
      type: "enum",
      required: true,
      options: statuses,
      optionSet: new Set(statuses)
    },
    {
      id: "category",
      type: "enum",
      required: true,
      options: categories,
      optionSet: new Set(categories)
    },
    {
      id: "labels",
      type: "enum-multi",
      required: false,
      options: labels,
      optionSet: new Set(labels)
    },
    {
      id: "publishedOn",
      type: "date",
      required: false
    },
    {
      id: "recordId",
      type: "reference",
      required: false,
      collectionId: referenceCollectionId
    },
    ...(includeComputedSlug
      ? [
          {
            id: "slug",
            type: "computed",
            required: false,
            source: "title",
            resolver: "slugify",
            transform: "slugify"
          }
        ]
      : [])
  ];
  return fallbackFieldDescriptors;
}

function assertTitleFieldDescriptorType(allFieldDescriptors, collectionId) {
  const titleFieldDescriptor = allFieldDescriptors.find((field) => field.id === "title");
  if (titleFieldDescriptor && titleFieldDescriptor.type !== "text") {
    const error = new Error(
      `Generated collection '${collectionId}' requires 'title' to use field type 'text'`
    );
    error.code = "GENERATED_COLLECTION_CONFIG_INVALID";
    throw error;
  }
}

function resolvePrimaryFieldDescriptor(allFieldDescriptors, configuredPrimaryField, collectionId) {
  const primaryFieldDescriptor =
    allFieldDescriptors.find((field) => field.id === configuredPrimaryField) ?? null;
  if (!primaryFieldDescriptor) {
    const error = new Error(
      `Generated collection '${collectionId}' primaryField '${configuredPrimaryField}' must match one of its fields`
    );
    error.code = "GENERATED_COLLECTION_CONFIG_INVALID";
    throw error;
  }

  if (primaryFieldDescriptor.type !== "text") {
    const error = new Error(
      `Generated collection '${collectionId}' requires primaryField '${configuredPrimaryField}' to use field type 'text'`
    );
    error.code = "GENERATED_COLLECTION_CONFIG_INVALID";
    throw error;
  }
  return primaryFieldDescriptor;
}

function applyPrimaryFieldLengthDefaults(
  primaryFieldDescriptor,
  resolvedPrimaryFieldMinLength,
  resolvedPrimaryFieldMaxLength
) {
  primaryFieldDescriptor.required = true;
  if (!Number.isInteger(primaryFieldDescriptor.minLength) || primaryFieldDescriptor.minLength < 0) {
    primaryFieldDescriptor.minLength = resolvedPrimaryFieldMinLength;
  }
  if (
    !Number.isInteger(primaryFieldDescriptor.maxLength) ||
    primaryFieldDescriptor.maxLength < primaryFieldDescriptor.minLength
  ) {
    const fallbackPrimaryMax = Math.max(
      resolvedPrimaryFieldMaxLength,
      primaryFieldDescriptor.minLength
    );
    primaryFieldDescriptor.maxLength = Math.max(
      fallbackPrimaryMax,
      primaryFieldDescriptor.minLength
    );
  }
}

function applyDescriptorNormalization(allFieldDescriptors, statuses, categories, labels) {
  for (const descriptor of allFieldDescriptors) {
    if (descriptor.type === "enum" || descriptor.type === "enum-multi") {
      if (!Array.isArray(descriptor.options) || descriptor.options.length === 0) {
        descriptor.options = normalizeSetValues(
          descriptor.id === "status"
            ? statuses
            : descriptor.id === "category"
              ? categories
              : descriptor.id === "labels"
                ? labels
                : [],
          descriptor.id === "status"
            ? DEFAULT_STATUSES
            : descriptor.id === "category"
              ? DEFAULT_CATEGORIES
              : DEFAULT_LABELS
        );
      }
      descriptor.optionSet = new Set(descriptor.options);
    }

    if (descriptor.type === "reference" || descriptor.type === "reference-multi") {
      descriptor.collectionId =
        typeof descriptor.collectionId === "string" && descriptor.collectionId.length > 0
          ? descriptor.collectionId
          : DEFAULT_REFERENCE_COLLECTION_ID;
      descriptor.referenceEntityTitle = toTitleCase(singularFromValue(descriptor.collectionId));
    }
  }
}

function resolveComputedFields(allFieldDescriptors) {
  return allFieldDescriptors
    .filter(
      (field) =>
        field.type === "computed" &&
        typeof field.source === "string" &&
        field.source.length > 0
    )
    .map((field) => ({
      id: field.id,
      source: field.source,
      resolver: resolveComputedResolverToken(field) ?? "slugify",
      ...(field.settings &&
      typeof field.settings === "object" &&
      !Array.isArray(field.settings) &&
      Object.keys(field.settings).length > 0
        ? {
            settings: {
              ...field.settings
            }
          }
        : {})
    }));
}

function resolvePublishedStatusRule(behavior, fieldDescriptorMap) {
  return behavior.requirePublishedOnWhenPublished &&
    fieldDescriptorMap.get("status")?.type === "enum" &&
    fieldDescriptorMap.get("status")?.optionSet?.has("published") &&
    fieldDescriptorMap.get("publishedOn")?.type === "date"
    ? {
        statusFieldId: "status",
        publishedOnFieldId: "publishedOn",
        publishedValue: "published"
      }
    : null;
}

function normalizeCollectionDefinition(rawCollection, index, manifestCollection = null) {
  const collectionId = resolveCollectionId(rawCollection, index);
  const { entitySingular, entityTitle, entityCode } = resolveCollectionIdentity(rawCollection, collectionId);
  const idPrefix = resolveCollectionIdPrefix(rawCollection, collectionId);
  const behavior = normalizeCollectionBehavior(
    resolveCollectionBehaviorInput(rawCollection, manifestCollection),
    collectionId
  );
  const { sequenceKey, sequenceKeyAliases } = resolveCollectionSequenceKeys(collectionId, entityTitle);
  const configuredPrimaryField = resolveConfiguredPrimaryField(rawCollection, manifestCollection);
  const { manifestFieldDescriptors, collectionFieldDescriptors } = parseCollectionFieldDescriptors(rawCollection, manifestCollection, collectionId);
  const descriptorSourceFieldMap = resolveDescriptorSourceFieldMap(manifestFieldDescriptors, collectionFieldDescriptors);
  const { statuses, categories, labels } = resolveCollectionSetValues(rawCollection, descriptorSourceFieldMap);
  const titleField = descriptorSourceFieldMap.get("title");
  const {
    primaryFieldMinLength: resolvedPrimaryFieldMinLength,
    primaryFieldMaxLength: resolvedPrimaryFieldMaxLength,
    titleMinLength,
    titleMaxLength
  } = normalizeCollectionLengthConfiguration({
    rawCollection,
    collectionId,
    configuredPrimaryField,
    titleField
  });
  const { includeComputedSlug, referenceCollectionId, referenceEntityTitle } = resolveReferenceCollectionConfiguration(rawCollection, descriptorSourceFieldMap);
  const fallbackFieldDescriptors = buildFallbackFieldDescriptors({
    titleMinLength,
    titleMaxLength,
    statuses,
    categories,
    labels,
    referenceCollectionId,
    includeComputedSlug
  });
  const allFieldDescriptors = dedupeFieldDescriptors(
    manifestFieldDescriptors.length > 0
      ? manifestFieldDescriptors
      : collectionFieldDescriptors.length > 0
        ? collectionFieldDescriptors
        : fallbackFieldDescriptors
  );
  assertTitleFieldDescriptorType(allFieldDescriptors, collectionId);
  const primaryFieldDescriptor = resolvePrimaryFieldDescriptor(allFieldDescriptors, configuredPrimaryField, collectionId);
  applyPrimaryFieldLengthDefaults(primaryFieldDescriptor, resolvedPrimaryFieldMinLength, resolvedPrimaryFieldMaxLength);
  applyDescriptorNormalization(allFieldDescriptors, statuses, categories, labels);

  const mutableFieldDescriptors = allFieldDescriptors.filter((field) =>
    MUTABLE_SUPPORTED_FIELD_TYPES.has(field.type)
  );
  const mutableFieldList = mutableFieldDescriptors.map((field) => field.id);
  const inputFieldSet = new Set(mutableFieldList);
  const computedFields = resolveComputedFields(allFieldDescriptors);
  const referenceFieldDescriptors = mutableFieldDescriptors.filter(
    (field) => field.type === "reference" || field.type === "reference-multi"
  );
  const queryFieldDescriptors = mutableFieldDescriptors.filter((field) =>
    QUERY_SUPPORTED_FIELD_TYPES.has(field.type)
  );
  const fieldDescriptorMap = new Map(allFieldDescriptors.map((field) => [field.id, field]));
  const publishedStatusRule = resolvePublishedStatusRule(behavior, fieldDescriptorMap);
  const recordReferenceField = referenceFieldDescriptors.find((field) => field.id === "recordId");

  return {
    collectionId,
    entitySingular,
    entityTitle,
    entityCode,
    idPrefix,
    statuses,
    statusSet: new Set(statuses),
    categories,
    categorySet: new Set(categories),
    labels,
    labelSet: new Set(labels),
    fieldDescriptors: allFieldDescriptors,
    fieldDescriptorMap,
    primaryField: primaryFieldDescriptor.id,
    mutableFieldDescriptors,
    queryFieldDescriptors,
    referenceFieldDescriptors,
    inputFieldSet,
    mutableFieldList,
    computedFields,
    behavior,
    primaryFieldMinLength:
      fieldDescriptorMap.get(primaryFieldDescriptor.id)?.minLength ?? resolvedPrimaryFieldMinLength,
    primaryFieldMaxLength:
      fieldDescriptorMap.get(primaryFieldDescriptor.id)?.maxLength ?? resolvedPrimaryFieldMaxLength,
    // Preserve legacy keys for deterministic compatibility.
    titleMinLength: fieldDescriptorMap.get("title")?.minLength ?? titleMinLength,
    titleMaxLength: fieldDescriptorMap.get("title")?.maxLength ?? titleMaxLength,
    referenceCollectionId: recordReferenceField?.collectionId ?? referenceCollectionId,
    referenceEntityTitle: recordReferenceField?.referenceEntityTitle ?? referenceEntityTitle,
    manifestFieldDescriptors: allFieldDescriptors,
    publishedStatusRule,
    stateKey: collectionId,
    sequenceKey,
    sequenceKeyAliases,
    schemaTypeKey: `reference-${entitySingular}-item`
  };
}

function normalizeCollectionDefinitions(
  rawCollections,
  moduleId = "generated-module",
  manifestCollections = []
) {
  const fallbackCollection = {
    collectionId: moduleId,
    entitySingular: singularFromValue(moduleId),
    idPrefix: normalizeIdPrefixSeed(moduleId)
  };

  const normalizedManifestCollections = Array.isArray(manifestCollections)
    ? manifestCollections
        .filter((collection) => collection && typeof collection === "object")
        .map((collection) => {
          const collectionId =
            typeof collection.id === "string" ? collection.id.trim() : "";
          const entitySingular =
            typeof collection.entitySingular === "string"
              ? collection.entitySingular.trim()
              : "";
          return {
            ...collection,
            id: collectionId,
            entitySingular
          };
        })
        .filter((collection) => collection.id.length > 0)
    : [];

  const sourceCollections =
    Array.isArray(rawCollections) && rawCollections.length > 0
      ? rawCollections
      : normalizedManifestCollections.length > 0
        ? normalizedManifestCollections.map((collection) => ({
            collectionId: collection.id,
            entitySingular:
              collection.entitySingular.length > 0
                ? collection.entitySingular
                : singularFromValue(collection.id),
            idPrefix: normalizeIdPrefixSeed(collection.id)
          }))
        : [fallbackCollection];

  const manifestCollectionMap = new Map(
    normalizedManifestCollections.map((collection) => [collection.id, collection])
  );

  return sourceCollections.map((collection, index) => {
    const collectionId =
      typeof collection?.collectionId === "string" ? collection.collectionId.trim() : "";
    const manifestCollection =
      collectionId.length > 0 ? manifestCollectionMap.get(collectionId) ?? null : null;
    return normalizeCollectionDefinition(collection, index, manifestCollection);
  });
}

export { normalizeCollectionDefinitions };
