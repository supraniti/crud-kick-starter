import {
  defaultFieldValue,
  normalizeFieldInputValue
} from "./field-value-normalizers.mjs";
import { toFieldCodeToken } from "./shared-utils.mjs";
import { readReferenceRows } from "./query-and-reference-helpers.mjs";
import {
  resolveCollectionFieldTypePlugin
} from "../../../shared/collection-field-type-plugin-registry.mjs";

function normalizeCollectionInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  return {
    ...input
  };
}

function codeFor(definition, suffix) {
  return `${definition.entityCode}_${suffix}`;
}

function codeForField(definition, fieldId, suffix) {
  return codeFor(definition, `${toFieldCodeToken(fieldId)}_${suffix}`);
}

function isPrimaryField(definition, fieldDescriptor) {
  return definition.primaryField === fieldDescriptor.id;
}

function formatFieldLabel(definition, fieldDescriptor) {
  return isPrimaryField(definition, fieldDescriptor)
    ? `${definition.primaryField}`
    : `${fieldDescriptor.id}`;
}

function hasExplicitDefaultValue(fieldDescriptor) {
  return (
    fieldDescriptor &&
    typeof fieldDescriptor === "object" &&
    Object.prototype.hasOwnProperty.call(fieldDescriptor, "defaultValue")
  );
}

function isMissingRequiredDefaultValue(fieldDescriptor, value) {
  if (fieldDescriptor.required !== true) {
    return false;
  }

  if (fieldDescriptor.type === "enum-multi" || fieldDescriptor.type === "reference-multi") {
    return !Array.isArray(value) || value.length === 0;
  }

  if (fieldDescriptor.type === "text" || fieldDescriptor.type === "url") {
    return typeof value !== "string" || value.length === 0;
  }

  return value === null || value === undefined;
}

function resolveFieldTypePluginValidationErrors(value, definition, fieldDescriptor) {
  const fieldTypePlugin = resolveCollectionFieldTypePlugin(fieldDescriptor?.type);
  if (!fieldTypePlugin || typeof fieldTypePlugin !== "object") {
    return [];
  }

  if (typeof fieldTypePlugin.runtime?.validateInputValue !== "function") {
    return [];
  }

  const pluginErrors = fieldTypePlugin.runtime.validateInputValue({
    value,
    definition,
    fieldDescriptor
  });
  if (!Array.isArray(pluginErrors) || pluginErrors.length === 0) {
    return [];
  }

  const normalizedPluginErrors = [];
  for (const pluginError of pluginErrors) {
    if (!pluginError || typeof pluginError !== "object") {
      continue;
    }

    const codeSuffix =
      typeof pluginError.codeSuffix === "string" && pluginError.codeSuffix.length > 0
        ? pluginError.codeSuffix
        : "INVALID";
    const message =
      typeof pluginError.message === "string" && pluginError.message.length > 0
        ? pluginError.message
        : `${definition.entityTitle} ${fieldDescriptor.id} is invalid`;

    normalizedPluginErrors.push({
      code: codeForField(definition, fieldDescriptor.id, codeSuffix),
      message,
      fieldId: fieldDescriptor.id,
      fieldType: fieldDescriptor.type
    });
  }

  return normalizedPluginErrors;
}

function buildDefaultInputValue(definition) {
  const value = {};
  for (const fieldDescriptor of definition.mutableFieldDescriptors) {
    value[fieldDescriptor.id] = defaultFieldValue(fieldDescriptor);
  }
  return value;
}

function buildInvalidPayloadResult(definition) {
  return {
    ok: false,
    value: buildDefaultInputValue(definition),
    errors: [
      {
        code: codeFor(definition, "PAYLOAD_INVALID"),
        message: `${definition.entityTitle} payload must be an object`
      }
    ]
  };
}

function appendUnknownFieldError(input, definition, errors) {
  const unknownField = Object.keys(input).find((key) => !definition.inputFieldSet.has(key));
  if (!unknownField) {
    return;
  }
  errors.push({
    code: codeFor(definition, "FIELD_UNKNOWN"),
    message: `${definition.entityTitle} field '${unknownField}' is not supported`
  });
}

function applyMissingFieldNormalization({
  partial,
  hasField,
  normalized,
  fieldDescriptor,
  definition,
  errors
}) {
  if (hasField) {
    return false;
  }

  const fallbackValue = defaultFieldValue(fieldDescriptor);
  normalized[fieldDescriptor.id] = fallbackValue;
  if (partial) {
    return true;
  }

  if (
    fieldDescriptor.required === true &&
    (!hasExplicitDefaultValue(fieldDescriptor) ||
      isMissingRequiredDefaultValue(fieldDescriptor, fallbackValue))
  ) {
    errors.push({
      code: codeForField(definition, fieldDescriptor.id, "REQUIRED"),
      message: `${definition.entityTitle} ${formatFieldLabel(definition, fieldDescriptor)} is required`
    });
  }
  return true;
}

function validateTextLikeFieldValue(value, definition, fieldDescriptor) {
  const errors = [];
  if (value.length === 0 && fieldDescriptor.required === true) {
    errors.push({
      code: codeForField(definition, fieldDescriptor.id, "REQUIRED"),
      message: `${definition.entityTitle} ${formatFieldLabel(definition, fieldDescriptor)} is required`
    });
  } else if (value.length > 0 || fieldDescriptor.required === true) {
    if (Number.isInteger(fieldDescriptor.minLength) && value.length < fieldDescriptor.minLength) {
      errors.push({
        code: codeForField(definition, fieldDescriptor.id, "TOO_SHORT"),
        message: `${definition.entityTitle} ${formatFieldLabel(definition, fieldDescriptor)} must be at least ${fieldDescriptor.minLength} characters`
      });
    }
    if (Number.isInteger(fieldDescriptor.maxLength) && value.length > fieldDescriptor.maxLength) {
      errors.push({
        code: codeForField(definition, fieldDescriptor.id, "TOO_LONG"),
        message: `${definition.entityTitle} ${formatFieldLabel(definition, fieldDescriptor)} must be at most ${fieldDescriptor.maxLength} characters`
      });
    }
  }
  return errors;
}

function validateEnumFieldValue(value, definition, fieldDescriptor) {
  if (fieldDescriptor.optionSet?.has(value)) {
    return [];
  }
  return [
    {
      code: codeForField(definition, fieldDescriptor.id, "INVALID"),
      message: `${definition.entityTitle} ${fieldDescriptor.id} must be one of: ${
        fieldDescriptor.options?.join(", ") ?? ""
      }`
    }
  ];
}

function validateEnumMultiFieldValue(value, definition, fieldDescriptor) {
  if (value === "__INVALID__") {
    return [
      {
        code: codeForField(definition, fieldDescriptor.id, "INVALID"),
        message: `${definition.entityTitle} ${fieldDescriptor.id} must be an array of strings`
      }
    ];
  }
  if (
    !Array.isArray(value) ||
    !fieldDescriptor.optionSet?.size ||
    !value.some((entry) => !fieldDescriptor.optionSet.has(entry))
  ) {
    return [];
  }
  return [
    {
      code:
        fieldDescriptor.id === "labels"
          ? codeFor(definition, "LABEL_INVALID")
          : codeForField(definition, fieldDescriptor.id, "OPTION_INVALID"),
      message: `${definition.entityTitle} ${fieldDescriptor.id} must be from: ${
        fieldDescriptor.options?.join(", ") ?? ""
      }`
    }
  ];
}

function validateNumberFieldValue(value, definition, fieldDescriptor) {
  if (value === "__INVALID__") {
    return [
      {
        code: codeForField(definition, fieldDescriptor.id, "INVALID"),
        message: `${definition.entityTitle} ${fieldDescriptor.id} must be a finite number`
      }
    ];
  }
  const errors = [];
  if (fieldDescriptor.required === true && value === null) {
    errors.push({
      code: codeForField(definition, fieldDescriptor.id, "REQUIRED"),
      message: `${definition.entityTitle} ${fieldDescriptor.id} is required`
    });
    return errors;
  }
  if (value !== null && Number.isFinite(fieldDescriptor.min) && value < fieldDescriptor.min) {
    errors.push({
      code: codeForField(definition, fieldDescriptor.id, "TOO_SMALL"),
      message: `${definition.entityTitle} ${fieldDescriptor.id} must be greater than or equal to ${fieldDescriptor.min}`
    });
  }
  if (value !== null && Number.isFinite(fieldDescriptor.max) && value > fieldDescriptor.max) {
    errors.push({
      code: codeForField(definition, fieldDescriptor.id, "TOO_LARGE"),
      message: `${definition.entityTitle} ${fieldDescriptor.id} must be less than or equal to ${fieldDescriptor.max}`
    });
  }
  return errors;
}

function validateBooleanFieldValue(value, definition, fieldDescriptor) {
  if (value === "__INVALID__") {
    return [
      {
        code: codeForField(definition, fieldDescriptor.id, "INVALID"),
        message: `${definition.entityTitle} ${fieldDescriptor.id} must be a boolean`
      }
    ];
  }
  if (fieldDescriptor.required === true && value === null) {
    return [
      {
        code: codeForField(definition, fieldDescriptor.id, "REQUIRED"),
        message: `${definition.entityTitle} ${fieldDescriptor.id} is required`
      }
    ];
  }
  return [];
}

function validateReferenceFieldValue(value, definition, fieldDescriptor) {
  if (value === "__INVALID__") {
    return [
      {
        code: codeForField(definition, fieldDescriptor.id, "INVALID"),
        message: `${definition.entityTitle} ${fieldDescriptor.id} must be null or a string id`
      }
    ];
  }
  if (fieldDescriptor.required === true && value === null) {
    return [
      {
        code: codeForField(definition, fieldDescriptor.id, "REQUIRED"),
        message: `${definition.entityTitle} ${fieldDescriptor.id} is required`
      }
    ];
  }
  return [];
}

function validateReferenceMultiFieldValue(value, definition, fieldDescriptor) {
  if (value !== "__INVALID__") {
    return [];
  }
  return [
    {
      code: codeForField(definition, fieldDescriptor.id, "INVALID"),
      message: `${definition.entityTitle} ${fieldDescriptor.id} must be an array of string ids`
    }
  ];
}

const FIELD_VALUE_VALIDATORS = Object.freeze({
  enum: validateEnumFieldValue,
  "enum-multi": validateEnumMultiFieldValue,
  number: validateNumberFieldValue,
  boolean: validateBooleanFieldValue,
  reference: validateReferenceFieldValue,
  "reference-multi": validateReferenceMultiFieldValue
});

function resolveFieldValidationErrors(value, definition, fieldDescriptor) {
  if (fieldDescriptor.type === "text" || fieldDescriptor.type === "url") {
    return [
      ...validateTextLikeFieldValue(value, definition, fieldDescriptor),
      ...resolveFieldTypePluginValidationErrors(value, definition, fieldDescriptor)
    ];
  }

  const pluginErrors = resolveFieldTypePluginValidationErrors(value, definition, fieldDescriptor);
  if (pluginErrors.length > 0) {
    return pluginErrors;
  }

  const validator = FIELD_VALUE_VALIDATORS[fieldDescriptor.type];
  return typeof validator === "function" ? validator(value, definition, fieldDescriptor) : [];
}

function validateCollectionInput(input, definition, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return buildInvalidPayloadResult(definition);
  }

  const partial = options.partial === true;
  const normalizedInput = normalizeCollectionInput(input);
  const normalized = {};
  const errors = [];
  appendUnknownFieldError(input, definition, errors);

  for (const fieldDescriptor of definition.mutableFieldDescriptors) {
    const rawValue = normalizedInput[fieldDescriptor.id];
    const hasField = rawValue !== undefined;
    if (
      applyMissingFieldNormalization({
        partial,
        hasField,
        normalized,
        fieldDescriptor,
        definition,
        errors
      })
    ) {
      continue;
    }

    const value = normalizeFieldInputValue(fieldDescriptor, rawValue);
    normalized[fieldDescriptor.id] = value;
    const fieldErrors = resolveFieldValidationErrors(value, definition, fieldDescriptor);
    if (fieldErrors.length > 0) {
      errors.push(...fieldErrors);
    }
  }

  return {
    ok: errors.length === 0,
    value: normalized,
    errors
  };
}

function validateCollectionCrossField(item, definition) {
  if (!definition.publishedStatusRule) {
    return null;
  }

  const statusValue = item?.[definition.publishedStatusRule.statusFieldId];
  const publishedOnValue = item?.[definition.publishedStatusRule.publishedOnFieldId];
  if (statusValue === definition.publishedStatusRule.publishedValue && publishedOnValue === null) {
    return {
      code: codeFor(definition, "PUBLISHED_ON_REQUIRED_FOR_PUBLISHED"),
      message: `${definition.entityTitle} publishedOn is required when status is published`
    };
  }

  return null;
}

async function validateReferenceFields(referenceLookup, item, definition) {
  const conflicts = await validateReferenceFieldConflicts(referenceLookup, item, definition);
  return conflicts[0] ?? null;
}

function resolveReferenceFieldNotFoundCode(definition, referenceField) {
  if (referenceField?.id === "recordId") {
    return codeFor(definition, "RECORD_NOT_FOUND");
  }

  return codeForField(definition, referenceField?.id, "NOT_FOUND");
}

function normalizeMissingReferenceIds(missingReferenceIds) {
  if (!Array.isArray(missingReferenceIds)) {
    return [];
  }

  return [...new Set(
    missingReferenceIds.filter(
      (referenceId) => typeof referenceId === "string" && referenceId.length > 0
    )
  )];
}

function createReferenceFieldConflict({
  definition,
  referenceField,
  missingReferenceIds
}) {
  const normalizedMissingReferenceIds = normalizeMissingReferenceIds(
    missingReferenceIds
  );
  if (normalizedMissingReferenceIds.length === 0) {
    return null;
  }

  const firstMissingReferenceId = normalizedMissingReferenceIds[0];
  const isMultiReferenceField = referenceField?.type === "reference-multi";
  const pluralSuffix = normalizedMissingReferenceIds.length > 1 ? "s" : "";
  const referenceListLabel = normalizedMissingReferenceIds.join(", ");

  return {
    code: resolveReferenceFieldNotFoundCode(definition, referenceField),
    message: isMultiReferenceField
      ? `${referenceField.referenceEntityTitle} '${referenceListLabel}' was not found for ${definition.entitySingular} ${referenceField.id} reference list`
      : `${referenceField.referenceEntityTitle} '${firstMissingReferenceId}' was not found for ${definition.entitySingular} reference`,
    fieldId: referenceField.id,
    fieldType: referenceField.type,
    referenceCollectionId: referenceField.collectionId,
    missingReferenceIds: normalizedMissingReferenceIds,
    missingCount: normalizedMissingReferenceIds.length,
    summary: `${normalizedMissingReferenceIds.length} missing reference${pluralSuffix}`
  };
}

async function validateReferenceFieldConflicts(referenceLookup, item, definition) {
  const conflicts = [];
  for (const referenceField of definition.referenceFieldDescriptors) {
    const referenceRows = await readReferenceRows(referenceLookup, referenceField.collectionId);
    const referenceRowIdSet = new Set(
      referenceRows
        .map((record) => record?.id)
        .filter((referenceId) => typeof referenceId === "string" && referenceId.length > 0)
    );
    if (referenceField.type === "reference-multi") {
      const referenceIds = Array.isArray(item?.[referenceField.id]) ? item[referenceField.id] : [];
      const missingReferenceIds = referenceIds.filter(
        (referenceId) => !referenceRowIdSet.has(referenceId)
      );
      const conflict = createReferenceFieldConflict({
        definition,
        referenceField,
        missingReferenceIds
      });
      if (conflict) {
        conflicts.push(conflict);
      }
      continue;
    }

    const referenceId = item?.[referenceField.id];
    if (referenceId === null) {
      continue;
    }
    if (
      referenceId === "__INVALID__" ||
      typeof referenceId !== "string" ||
      referenceId.length === 0
    ) {
      continue;
    }

    if (!referenceRowIdSet.has(referenceId)) {
      const conflict = createReferenceFieldConflict({
        definition,
        referenceField,
        missingReferenceIds: [referenceId]
      });
      if (conflict) {
        conflicts.push(conflict);
      }
    }
  }

  return conflicts;
}

function hasTitleConflict(workingState, definition, title, excludeId = null) {
  if (typeof title !== "string") {
    return false;
  }

  const normalized = title.trim().toLowerCase();
  if (normalized.length === 0) {
    return false;
  }

  const conflictFieldId =
    typeof definition?.primaryField === "string" && definition.primaryField.length > 0
      ? definition.primaryField
      : "title";
  return (workingState[definition.stateKey] ?? []).some((item) => {
    if (excludeId && item.id === excludeId) {
      return false;
    }
    const candidate = item?.[conflictFieldId];
    return typeof candidate === "string" && candidate.trim().toLowerCase() === normalized;
  });
}

export {
  codeFor,
  codeForField,
  hasTitleConflict,
  validateCollectionCrossField,
  validateCollectionInput,
  validateReferenceFieldConflicts,
  validateReferenceFields
};
