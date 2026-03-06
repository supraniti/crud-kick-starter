import {
  COLLECTION_FIELD_ID_PATTERN_LABEL,
  DEFAULT_PROFILE_CATEGORY_OPTIONS,
  DEFAULT_PROFILE_LABEL_OPTIONS,
  DEFAULT_PROFILE_STATUS_OPTIONS,
  RESERVED_COLLECTION_FIELD_IDS,
  isCollectionFieldId,
  isKebabCaseIdentifier,
  normalizeIdPrefixSeed,
  toSingularLabel
} from "../shared.mjs";
import { normalizeProfileCollectionBehavior, normalizeProfileOptionValues } from "./collection-option-normalization.mjs";
import {
  normalizeProfileExtraFieldDescriptor,
  normalizeProfileFieldDescriptor
} from "./field-descriptor-normalization.mjs";
import {
  buildDefaultCollectionFieldDescriptors,
  deriveCollectionPrimitiveMetadataFromFieldDescriptors
} from "./template-field-descriptors.mjs";

function normalizeProfileCollection(collection, index, details, unsupportedDetails) {
  if (!collection || typeof collection !== "object" || Array.isArray(collection)) {
    details.push(`profile.collections[${index}] must be an object`);
    return null;
  }

  const collectionId = `${collection.id ?? ""}`.trim();
  const collectionLabel = `${collection.label ?? ""}`.trim();
  const entitySingular = `${collection.entitySingular ?? toSingularLabel(collectionLabel)}`.trim();
  const idPrefix = `${collection.idPrefix ?? normalizeIdPrefixSeed(collectionId)}`
    .trim()
    .toLowerCase();
  const explicitPrimaryField =
    collection.primaryField === undefined ? null : `${collection.primaryField ?? ""}`.trim();

  if (!isKebabCaseIdentifier(collectionId)) {
    details.push(`profile.collections[${index}].id must match kebab-case pattern`);
  }
  if (collectionLabel.length === 0) {
    details.push(`profile.collections[${index}].label is required`);
  }
  if (!/^[A-Za-z][A-Za-z0-9 -]*$/.test(entitySingular)) {
    details.push(
      `profile.collections[${index}].entitySingular must start with a letter and contain alphanumeric/spaces/hyphen`
    );
  }
  if (!/^[a-z][a-z0-9]{1,7}$/.test(idPrefix)) {
    details.push(`profile.collections[${index}].idPrefix must match /^[a-z][a-z0-9]{1,7}$/`);
  }
  if (explicitPrimaryField !== null && !isCollectionFieldId(explicitPrimaryField)) {
    details.push(
      `profile.collections[${index}].primaryField must be ${COLLECTION_FIELD_ID_PATTERN_LABEL} when provided`
    );
  }
  const normalizedPrimaryField =
    explicitPrimaryField && explicitPrimaryField.length > 0 ? explicitPrimaryField : "title";

  const behavior = normalizeProfileCollectionBehavior(
    collection.behavior,
    details,
    `profile.collections[${index}].behavior`
  );

  const hasExplicitFieldDescriptors = Array.isArray(collection.fields);
  let fieldDescriptors = [];
  if (collection.fields !== undefined && !hasExplicitFieldDescriptors) {
    details.push(`profile.collections[${index}].fields must be an array when provided`);
  } else if (hasExplicitFieldDescriptors) {
    fieldDescriptors = collection.fields
      .map((field, fieldIndex) =>
        normalizeProfileFieldDescriptor(
          field,
          `profile.collections[${index}].fields[${fieldIndex}]`,
          details
        )
      )
      .filter(Boolean);
  }

  if (hasExplicitFieldDescriptors) {
    if (fieldDescriptors.length === 0) {
      details.push(
        `profile.collections[${index}].fields must include at least one valid field descriptor`
      );
    }

    const seenFieldIds = new Set();
    for (const field of fieldDescriptors) {
      if (seenFieldIds.has(field.id)) {
        details.push(`profile.collections[${index}].fields field id '${field.id}' must be unique`);
        continue;
      }
      seenFieldIds.add(field.id);
    }

    const primaryFieldDescriptor =
      fieldDescriptors.find((field) => field.id === normalizedPrimaryField) ?? null;
    if (!primaryFieldDescriptor) {
      details.push(
        `profile.collections[${index}].primaryField '${normalizedPrimaryField}' must match one of profile.collections[${index}].fields ids`
      );
    } else if (primaryFieldDescriptor.type !== "text") {
      details.push(
        `profile.collections[${index}].primaryField '${normalizedPrimaryField}' must reference a text field`
      );
    }

    const conflictingPrimitiveOptions = [
      "statusOptions",
      "categoryOptions",
      "labelOptions",
      "referenceCollectionId",
      "primaryFieldMinLength",
      "primaryFieldMaxLength",
      "titleMinLength",
      "titleMaxLength",
      "includeComputedSlug",
      "extraFields"
    ].filter((key) => collection[key] !== undefined);
    if (conflictingPrimitiveOptions.length > 0) {
      unsupportedDetails.push(
        `profile.collections[${index}].fields cannot be combined with legacy primitive options: ${conflictingPrimitiveOptions.join(
          ", "
        )}`
      );
    }

    const derivedPrimitives =
      deriveCollectionPrimitiveMetadataFromFieldDescriptors(
        fieldDescriptors,
        normalizedPrimaryField
      );

    return {
      id: collectionId,
      label: collectionLabel,
      entitySingular,
      idPrefix,
      primaryField: normalizedPrimaryField,
      behavior,
      ...derivedPrimitives,
      extraFields: [],
      fieldDescriptors
    };
  }

  const statusOptions =
    normalizeProfileOptionValues(
      collection.statusOptions,
      details,
      `profile.collections[${index}].statusOptions`
    ) ?? [...DEFAULT_PROFILE_STATUS_OPTIONS];
  const categoryOptions =
    normalizeProfileOptionValues(
      collection.categoryOptions,
      details,
      `profile.collections[${index}].categoryOptions`
    ) ?? [...DEFAULT_PROFILE_CATEGORY_OPTIONS];
  const labelOptions =
    normalizeProfileOptionValues(
      collection.labelOptions,
      details,
      `profile.collections[${index}].labelOptions`
    ) ?? [...DEFAULT_PROFILE_LABEL_OPTIONS];
  const referenceCollectionId = `${collection.referenceCollectionId ?? "records"}`
    .trim()
    .toLowerCase();
  if (!isKebabCaseIdentifier(referenceCollectionId)) {
    details.push(
      `profile.collections[${index}].referenceCollectionId must match kebab-case pattern`
    );
  }

  const rawPrimaryFieldMinLength =
    Number.isInteger(collection.primaryFieldMinLength) && collection.primaryFieldMinLength >= 1
      ? collection.primaryFieldMinLength
      : collection.primaryFieldMinLength === undefined
        ? undefined
        : null;
  const rawPrimaryFieldMaxLength =
    Number.isInteger(collection.primaryFieldMaxLength) && collection.primaryFieldMaxLength >= 1
      ? collection.primaryFieldMaxLength
      : collection.primaryFieldMaxLength === undefined
        ? undefined
        : null;
  const rawTitleMinLength =
    Number.isInteger(collection.titleMinLength) && collection.titleMinLength >= 1
      ? collection.titleMinLength
      : collection.titleMinLength === undefined
        ? undefined
        : null;
  const rawTitleMaxLength =
    Number.isInteger(collection.titleMaxLength) && collection.titleMaxLength >= 1
      ? collection.titleMaxLength
      : collection.titleMaxLength === undefined
        ? undefined
        : null;

  if (rawPrimaryFieldMinLength === null) {
    details.push(`profile.collections[${index}].primaryFieldMinLength must be an integer >= 1`);
  }
  if (rawPrimaryFieldMaxLength === null) {
    details.push(`profile.collections[${index}].primaryFieldMaxLength must be an integer >= 1`);
  }
  if (rawTitleMinLength === null) {
    details.push(`profile.collections[${index}].titleMinLength must be an integer >= 1`);
  }
  if (rawTitleMaxLength === null) {
    details.push(`profile.collections[${index}].titleMaxLength must be an integer >= 1`);
  }
  if (
    Number.isInteger(rawPrimaryFieldMinLength) &&
    Number.isInteger(rawTitleMinLength) &&
    rawPrimaryFieldMinLength !== rawTitleMinLength
  ) {
    details.push(
      `profile.collections[${index}].primaryFieldMinLength and profile.collections[${index}].titleMinLength must match when both are provided`
    );
  }
  if (
    Number.isInteger(rawPrimaryFieldMaxLength) &&
    Number.isInteger(rawTitleMaxLength) &&
    rawPrimaryFieldMaxLength !== rawTitleMaxLength
  ) {
    details.push(
      `profile.collections[${index}].primaryFieldMaxLength and profile.collections[${index}].titleMaxLength must match when both are provided`
    );
  }

  const primaryFieldMinLength =
    Number.isInteger(rawPrimaryFieldMinLength)
      ? rawPrimaryFieldMinLength
      : Number.isInteger(rawTitleMinLength)
        ? rawTitleMinLength
        : 3;
  const primaryFieldMaxLength =
    Number.isInteger(rawPrimaryFieldMaxLength)
      ? rawPrimaryFieldMaxLength
      : Number.isInteger(rawTitleMaxLength)
        ? rawTitleMaxLength
        : 120;

  if (primaryFieldMaxLength < primaryFieldMinLength) {
    details.push(
      `profile.collections[${index}].primaryFieldMaxLength must be greater than or equal to primaryFieldMinLength`
    );
  }

  // Preserve legacy aliases for deterministic compatibility.
  const titleMinLength = primaryFieldMinLength;
  const titleMaxLength = primaryFieldMaxLength;

  if (
    collection.includeComputedSlug !== undefined &&
    typeof collection.includeComputedSlug !== "boolean"
  ) {
    details.push(`profile.collections[${index}].includeComputedSlug must be a boolean when provided`);
  }

  let extraFields = [];
  if (collection.extraFields !== undefined && !Array.isArray(collection.extraFields)) {
    details.push(`profile.collections[${index}].extraFields must be an array when provided`);
  } else if (Array.isArray(collection.extraFields)) {
    extraFields = collection.extraFields
      .map((field, fieldIndex) =>
        normalizeProfileExtraFieldDescriptor(field, index, fieldIndex, details)
      )
      .filter(Boolean);
  }

  const reservedFieldIds = new Set(RESERVED_COLLECTION_FIELD_IDS);
  const seenExtraFieldIds = new Set();
  for (const field of extraFields) {
    if (reservedFieldIds.has(field.id)) {
      details.push(
        `profile.collections[${index}].extraFields field id '${field.id}' is reserved by generated template fields`
      );
      continue;
    }
    if (seenExtraFieldIds.has(field.id)) {
      details.push(
        `profile.collections[${index}].extraFields field id '${field.id}' must be unique`
      );
      continue;
    }
    seenExtraFieldIds.add(field.id);
  }

  const defaultFieldDescriptors = buildDefaultCollectionFieldDescriptors({
    statusOptions,
    categoryOptions,
    labelOptions,
    referenceCollectionId,
    primaryFieldMinLength,
    primaryFieldMaxLength,
    titleMinLength,
    titleMaxLength,
    primaryField: normalizedPrimaryField,
    includeComputedSlug:
      collection.includeComputedSlug === undefined ? true : collection.includeComputedSlug,
    extraFields
  });
  const defaultPrimaryFieldDescriptor =
    defaultFieldDescriptors.find((field) => field.id === normalizedPrimaryField) ?? null;
  if (!defaultPrimaryFieldDescriptor) {
    details.push(
      `profile.collections[${index}].primaryField '${normalizedPrimaryField}' must match one of collection field ids`
    );
  } else if (defaultPrimaryFieldDescriptor.type !== "text") {
    details.push(
      `profile.collections[${index}].primaryField '${normalizedPrimaryField}' must reference a text field`
    );
  }

  return {
    id: collectionId,
    label: collectionLabel,
    entitySingular,
    idPrefix,
    behavior,
    statusOptions,
    categoryOptions,
    labelOptions,
    referenceCollectionId,
    primaryFieldMinLength,
    primaryFieldMaxLength,
    titleMinLength,
    titleMaxLength,
    primaryField: normalizedPrimaryField,
    includeComputedSlug:
      collection.includeComputedSlug === undefined ? true : collection.includeComputedSlug,
    extraFields,
    fieldDescriptors: defaultFieldDescriptors
  };
}

export { normalizeProfileCollection };
