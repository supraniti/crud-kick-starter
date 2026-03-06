import {
  DEFAULT_PROFILE_CATEGORY_OPTIONS,
  DEFAULT_PROFILE_LABEL_OPTIONS,
  DEFAULT_PROFILE_STATUS_OPTIONS
} from "../shared.mjs";

function deriveCollectionPrimitiveMetadataFromFieldDescriptors(
  fieldDescriptors,
  primaryField = "title"
) {
  const titleField = fieldDescriptors.find(
    (field) => field.id === "title" && field.type === "text"
  );
  const statusField = fieldDescriptors.find(
    (field) => field.id === "status" && field.type === "enum"
  );
  const categoryField = fieldDescriptors.find(
    (field) => field.id === "category" && field.type === "enum"
  );
  const labelsField = fieldDescriptors.find(
    (field) => field.id === "labels" && field.type === "enum-multi"
  );
  const recordReferenceField = fieldDescriptors.find(
    (field) => field.id === "recordId" && field.type === "reference"
  );
  const slugField = fieldDescriptors.find(
    (field) => field.id === "slug" && field.type === "computed"
  );
  const resolvedPrimaryField =
    typeof primaryField === "string" && primaryField.length > 0 ? primaryField : "title";
  const primaryFieldDescriptor = fieldDescriptors.find(
    (field) => field.id === resolvedPrimaryField && field.type === "text"
  );

  const titleMinLength =
    Number.isInteger(titleField?.minLength) && titleField.minLength >= 0
      ? titleField.minLength
      : 3;
  const titleMaxLength =
    Number.isInteger(titleField?.maxLength) && titleField.maxLength >= titleMinLength
      ? titleField.maxLength
      : 120;
  const primaryFieldMinLength =
    Number.isInteger(primaryFieldDescriptor?.minLength) && primaryFieldDescriptor.minLength >= 0
      ? primaryFieldDescriptor.minLength
      : resolvedPrimaryField === "title"
        ? titleMinLength
        : 1;
  const primaryFieldMaxLength =
    Number.isInteger(primaryFieldDescriptor?.maxLength) &&
    primaryFieldDescriptor.maxLength >= primaryFieldMinLength
      ? primaryFieldDescriptor.maxLength
      : resolvedPrimaryField === "title"
        ? titleMaxLength
        : Math.max(120, primaryFieldMinLength);

  return {
    statusOptions:
      Array.isArray(statusField?.options) && statusField.options.length > 0
        ? statusField.options
        : [...DEFAULT_PROFILE_STATUS_OPTIONS],
    categoryOptions:
      Array.isArray(categoryField?.options) && categoryField.options.length > 0
        ? categoryField.options
        : [...DEFAULT_PROFILE_CATEGORY_OPTIONS],
    labelOptions:
      Array.isArray(labelsField?.options) && labelsField.options.length > 0
        ? labelsField.options
        : [...DEFAULT_PROFILE_LABEL_OPTIONS],
    referenceCollectionId:
      typeof recordReferenceField?.collectionId === "string" &&
      recordReferenceField.collectionId.length > 0
        ? recordReferenceField.collectionId
        : "records",
    primaryFieldMinLength,
    primaryFieldMaxLength,
    titleMinLength,
    titleMaxLength,
    primaryField: resolvedPrimaryField,
    includeComputedSlug:
      !!slugField &&
      slugField.source === resolvedPrimaryField &&
      (slugField.resolver ?? slugField.transform ?? "slugify") === "slugify"
  };
}

function buildDefaultCollectionFieldDescriptors(collection) {
  const primaryField =
    typeof collection?.primaryField === "string" && collection.primaryField.length > 0
      ? collection.primaryField
      : "title";
  const primaryFieldMinLength =
    Number.isInteger(collection?.primaryFieldMinLength) && collection.primaryFieldMinLength >= 1
      ? collection.primaryFieldMinLength
      : Number.isInteger(collection?.titleMinLength) && collection.titleMinLength >= 1
        ? collection.titleMinLength
        : 3;
  const primaryFieldMaxLength =
    Number.isInteger(collection?.primaryFieldMaxLength) &&
    collection.primaryFieldMaxLength >= primaryFieldMinLength
      ? collection.primaryFieldMaxLength
      : Number.isInteger(collection?.titleMaxLength) &&
          collection.titleMaxLength >= primaryFieldMinLength
        ? collection.titleMaxLength
        : Math.max(120, primaryFieldMinLength);
  return [
    {
      id: "title",
      label: "Title",
      type: "text",
      required: true,
      minLength: primaryFieldMinLength,
      maxLength: primaryFieldMaxLength
    },
    {
      id: "status",
      label: "Status",
      type: "enum",
      required: true,
      options: collection.statusOptions
    },
    {
      id: "category",
      label: "Category",
      type: "enum",
      required: true,
      options: collection.categoryOptions
    },
    {
      id: "labels",
      label: "Labels",
      type: "enum-multi",
      required: false,
      options: collection.labelOptions
    },
    {
      id: "publishedOn",
      label: "Published On",
      type: "date",
      required: false
    },
    {
      id: "recordId",
      label: "Related Record",
      type: "reference",
      required: false,
      collectionId: collection.referenceCollectionId
    },
    ...(Array.isArray(collection.extraFields) ? collection.extraFields : []),
    ...(collection.includeComputedSlug
      ? [
          {
            id: "slug",
            label: "Slug",
            type: "computed",
            required: false,
            source: primaryField,
            resolver: "slugify",
            transform: "slugify"
          }
        ]
      : [])
  ];
}

export {
  buildDefaultCollectionFieldDescriptors,
  deriveCollectionPrimitiveMetadataFromFieldDescriptors
};
