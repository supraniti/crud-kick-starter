import { toReferenceMultiQueryKey } from "../../../../runtime/shared-capability-bridges/reference-field-key-utils.mjs";

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

function toFieldOptions(rawField) {
  if (!Array.isArray(rawField?.options)) {
    return [];
  }
  const normalized = [];
  for (const option of rawField.options) {
    const value =
      typeof option === "string"
        ? option
        : typeof option?.value === "string"
          ? option.value
          : null;
    if (!value || normalized.some((existing) => existing.value === value)) {
      continue;
    }
    normalized.push({
      value,
      label:
        typeof option === "object" &&
        option !== null &&
        typeof option.label === "string" &&
        option.label.length > 0
          ? option.label
          : value
    });
  }
  return normalized;
}

function normalizeReferenceUiFilter(rawFilter) {
  if (!rawFilter || typeof rawFilter !== "object" || Array.isArray(rawFilter)) {
    return undefined;
  }

  const fieldId =
    typeof rawFilter.fieldId === "string" && rawFilter.fieldId.length > 0
      ? rawFilter.fieldId
      : "";
  if (!fieldId) {
    return undefined;
  }

  if (
    typeof rawFilter.sourceFieldId === "string" &&
    rawFilter.sourceFieldId.length > 0
  ) {
    return {
      fieldId,
      sourceFieldId: rawFilter.sourceFieldId
    };
  }

  return {
    fieldId,
    value: rawFilter.value ?? null
  };
}

function normalizeReferenceUiVisibleWhen(rawVisibleWhen) {
  if (!rawVisibleWhen || typeof rawVisibleWhen !== "object" || Array.isArray(rawVisibleWhen)) {
    return undefined;
  }

  const sourceFieldId =
    typeof rawVisibleWhen.sourceFieldId === "string" && rawVisibleWhen.sourceFieldId.length > 0
      ? rawVisibleWhen.sourceFieldId
      : "";
  const collectionId =
    typeof rawVisibleWhen.collectionId === "string" && rawVisibleWhen.collectionId.length > 0
      ? rawVisibleWhen.collectionId
      : "";
  const valueField =
    typeof rawVisibleWhen.valueField === "string" && rawVisibleWhen.valueField.length > 0
      ? rawVisibleWhen.valueField
      : "";
  if (!sourceFieldId || !collectionId || !valueField) {
    return undefined;
  }

  const matchField =
    typeof rawVisibleWhen.matchField === "string" && rawVisibleWhen.matchField.length > 0
      ? rawVisibleWhen.matchField
      : "id";

  return {
    sourceFieldId,
    collectionId,
    matchField,
    valueField,
    equals: rawVisibleWhen.equals ?? true
  };
}

function normalizeReferenceUiInlineCreateDefaults(rawDefaults) {
  if (!Array.isArray(rawDefaults)) {
    return undefined;
  }

  const normalized = rawDefaults
    .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
    .map((entry) => {
      const fieldId =
        typeof entry.fieldId === "string" && entry.fieldId.length > 0 ? entry.fieldId : "";
      if (!fieldId) {
        return null;
      }

      if (typeof entry.sourceFieldId === "string" && entry.sourceFieldId.length > 0) {
        return {
          fieldId,
          sourceFieldId: entry.sourceFieldId
        };
      }

      return {
        fieldId,
        value: entry.value ?? null
      };
    })
    .filter(Boolean);

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeReferenceUi(rawReferenceUi) {
  if (!rawReferenceUi || typeof rawReferenceUi !== "object" || Array.isArray(rawReferenceUi)) {
    return undefined;
  }

  const normalized = {};
  if (typeof rawReferenceUi.inlineCreate === "boolean") {
    normalized.inlineCreate = rawReferenceUi.inlineCreate;
  }

  const optionsFilter = normalizeReferenceUiFilter(rawReferenceUi.optionsFilter);
  if (optionsFilter) {
    normalized.optionsFilter = optionsFilter;
  }

  const visibleWhen = normalizeReferenceUiVisibleWhen(rawReferenceUi.visibleWhen);
  if (visibleWhen) {
    normalized.visibleWhen = visibleWhen;
  }

  const inlineCreateDefaults = normalizeReferenceUiInlineCreateDefaults(
    rawReferenceUi.inlineCreateDefaults
  );
  if (inlineCreateDefaults) {
    normalized.inlineCreateDefaults = inlineCreateDefaults;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function toDefinedString(value) {
  return typeof value === "string" ? value : undefined;
}

function toNonEmptyString(value) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function toInteger(value) {
  return Number.isInteger(value) ? value : undefined;
}

function toNumber(value) {
  return typeof value === "number" ? value : undefined;
}

function cloneObjectValue(value) {
  return value && typeof value === "object" ? cloneJsonValue(value) : undefined;
}

function resolveSchemaFieldLabel(rawField) {
  return toNonEmptyString(rawField.label) ?? rawField.id;
}

function resolveSchemaFieldDefault(rawField) {
  return rawField.default ?? rawField.defaultValue ?? undefined;
}

function toSchemaField(rawField) {
  return {
    id: rawField.id,
    label: resolveSchemaFieldLabel(rawField),
    type: rawField.type,
    required: rawField.required === true,
    default: resolveSchemaFieldDefault(rawField),
    minLength: toInteger(rawField.minLength),
    maxLength: toInteger(rawField.maxLength),
    min: toNumber(rawField.min),
    max: toNumber(rawField.max),
    constraints: cloneObjectValue(rawField.constraints),
    objectSchema: cloneObjectValue(rawField.objectSchema),
    objectArrayConstraints: cloneObjectValue(rawField.objectArrayConstraints),
    collectionId: toDefinedString(rawField.collectionId),
    labelField: toNonEmptyString(rawField.labelField),
    onDelete: toNonEmptyString(rawField.onDelete),
    onDeleteSetting: toNonEmptyString(rawField.onDeleteSetting),
    referenceUi: normalizeReferenceUi(rawField.referenceUi),
    options: toFieldOptions(rawField)
  };
}

function resolveCollectionSchemaFields(collectionSchema, collectionId) {
  if (Array.isArray(collectionSchema?.fields) && collectionSchema.fields.length > 0) {
    return collectionSchema.fields.map(toSchemaField);
  }

  return [];
}

function resolveEditableCollectionFields(collectionSchema, collectionId) {
  return resolveCollectionSchemaFields(collectionSchema, collectionId).filter(
    (field) => field.type !== "computed"
  );
}

function resolveCollectionFilterFieldConfigs(collectionSchema, collectionId) {
  return resolveCollectionSchemaFields(collectionSchema, collectionId)
    .filter((field) =>
      ["enum", "enum-multi", "reference", "reference-multi"].includes(field.type)
    )
    .map((field) => ({
      fieldId: field.id,
      type: field.type,
      queryKey:
        field.type === "reference-multi"
          ? toReferenceMultiQueryKey(field.id)
          : field.id,
      multi: field.type === "enum-multi",
      collectionId: field.collectionId ?? null
    }));
}

function resolveReferenceCollectionIds(collectionSchema, collectionId) {
  return [...new Set(
    resolveEditableCollectionFields(collectionSchema, collectionId)
      .filter((field) => field.type === "reference" || field.type === "reference-multi")
      .map((field) => field.collectionId)
      .filter((collectionRefId) => typeof collectionRefId === "string" && collectionRefId.length > 0)
  )];
}

export {
  cloneJsonValue,
  resolveCollectionSchemaFields,
  resolveEditableCollectionFields,
  resolveCollectionFilterFieldConfigs,
  resolveReferenceCollectionIds
};
