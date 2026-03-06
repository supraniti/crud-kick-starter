import {
  COLLECTION_FIELD_ID_PATTERN_LABEL,
  SUPPORTED_COLLECTION_FIELD_TYPES_LABEL,
  isSupportedProfileFieldType,
  isCollectionFieldId,
  isKebabCaseIdentifier
} from "../shared.mjs";
import {
  DEFAULT_COMPUTED_RESOLVER,
  resolveComputedResolverSettingOptionSchema,
  SUPPORTED_COMPUTED_RESOLVERS_LABEL,
  isSupportedComputedResolverToken,
  normalizeComputedResolverToken
} from "../../../src/core/shared/capability-contracts/local-kernel/computed-resolver-catalog.mjs";
import {
  valuesEqual
} from "../../../src/core/shared/capability-contracts/local-kernel/value-contract-utils.mjs";
import {
  resolveCollectionFieldTypePlugin
} from "../../../src/core/shared/capability-contracts/local-kernel/collection-field-type-plugin-registry.mjs";
import { normalizeProfileOptionValues } from "./collection-option-normalization.mjs";

function resolveProfileFieldDefaultValue(field, pathLabel, details) {
  const hasDefault = Object.prototype.hasOwnProperty.call(field, "default");
  const hasDefaultValue = Object.prototype.hasOwnProperty.call(field, "defaultValue");

  if (!hasDefault && !hasDefaultValue) {
    return {
      hasDefault: false,
      value: undefined
    };
  }

  if (hasDefault && hasDefaultValue && !valuesEqual(field.default, field.defaultValue)) {
    details.push(`${pathLabel}.default and ${pathLabel}.defaultValue must match when both are provided`);
  }

  return {
    hasDefault: true,
    value: hasDefaultValue ? field.defaultValue : field.default
  };
}

function normalizeProfileFieldDefaultValue(descriptor, rawValue, pathLabel, details) {
  if (descriptor.type === "computed") {
    details.push(`${pathLabel}.defaultValue is not supported for computed fields`);
    return;
  }

  if (rawValue === null) {
    if (descriptor.required === true) {
      details.push(`${pathLabel}.defaultValue cannot be null when field is required`);
      return;
    }
    descriptor.defaultValue = null;
    return;
  }

  if (descriptor.type === "text") {
    if (typeof rawValue !== "string") {
      details.push(`${pathLabel}.defaultValue must be a string or null`);
      return;
    }

    const normalized = rawValue.trim();
    if (descriptor.required === true && normalized.length === 0) {
      details.push(`${pathLabel}.defaultValue cannot be empty when field is required`);
      return;
    }
    if (Number.isInteger(descriptor.minLength) && normalized.length < descriptor.minLength) {
      details.push(`${pathLabel}.defaultValue must be at least ${descriptor.minLength} characters`);
      return;
    }
    if (Number.isInteger(descriptor.maxLength) && normalized.length > descriptor.maxLength) {
      details.push(`${pathLabel}.defaultValue must be at most ${descriptor.maxLength} characters`);
      return;
    }

    descriptor.defaultValue = normalized;
    return;
  }

  const fieldTypePlugin = resolveCollectionFieldTypePlugin(descriptor.type);
  if (fieldTypePlugin && typeof fieldTypePlugin.normalizeDefaultValue === "function") {
    const normalizedDefault =
      fieldTypePlugin.normalizeDefaultValue(
        descriptor,
        rawValue
      );

    if (!normalizedDefault || normalizedDefault.ok !== true) {
      const reason =
        typeof normalizedDefault?.reason === "string"
          ? normalizedDefault.reason
          : "must be a string or null";
      const normalizedReason = reason.startsWith("defaultValue ")
        ? reason.slice("defaultValue ".length)
        : reason;
      details.push(
        `${pathLabel}.defaultValue ${normalizedReason}`
      );
      return;
    }

    descriptor.defaultValue = normalizedDefault.value;
    return;
  }

  if (descriptor.type === "number") {
    if (!Number.isFinite(rawValue)) {
      details.push(`${pathLabel}.defaultValue must be a finite number or null`);
      return;
    }
    if (Number.isFinite(descriptor.min) && rawValue < descriptor.min) {
      details.push(`${pathLabel}.defaultValue must be >= ${descriptor.min}`);
      return;
    }
    if (Number.isFinite(descriptor.max) && rawValue > descriptor.max) {
      details.push(`${pathLabel}.defaultValue must be <= ${descriptor.max}`);
      return;
    }

    descriptor.defaultValue = rawValue;
    return;
  }

  if (descriptor.type === "boolean") {
    if (typeof rawValue !== "boolean") {
      details.push(`${pathLabel}.defaultValue must be a boolean or null`);
      return;
    }

    descriptor.defaultValue = rawValue;
    return;
  }

  if (descriptor.type === "enum") {
    if (typeof rawValue !== "string") {
      details.push(`${pathLabel}.defaultValue must be a string or null`);
      return;
    }

    const normalized = rawValue.trim().toLowerCase();
    const optionSet = new Set(descriptor.options ?? []);
    if (!optionSet.has(normalized)) {
      details.push(`${pathLabel}.defaultValue '${normalized}' is not in options`);
      return;
    }

    descriptor.defaultValue = normalized;
    return;
  }

  if (descriptor.type === "enum-multi") {
    if (!Array.isArray(rawValue)) {
      details.push(`${pathLabel}.defaultValue must be an array of strings or null`);
      return;
    }

    const optionSet = new Set(descriptor.options ?? []);
    const normalized = [];
    const seen = new Set();
    for (const [index, value] of rawValue.entries()) {
      if (typeof value !== "string") {
        details.push(`${pathLabel}.defaultValue[${index}] must be a string`);
        return;
      }
      const token = value.trim().toLowerCase();
      if (!optionSet.has(token)) {
        details.push(`${pathLabel}.defaultValue '${token}' is not in options`);
        return;
      }
      if (seen.has(token)) {
        continue;
      }
      seen.add(token);
      normalized.push(token);
    }
    if (descriptor.required === true && normalized.length === 0) {
      details.push(`${pathLabel}.defaultValue must include at least one value when field is required`);
      return;
    }

    descriptor.defaultValue = normalized;
    return;
  }

  if (descriptor.type === "reference") {
    if (typeof rawValue !== "string") {
      details.push(`${pathLabel}.defaultValue must be a string id or null`);
      return;
    }

    const normalized = rawValue.trim();
    if (descriptor.required === true && normalized.length === 0) {
      details.push(`${pathLabel}.defaultValue cannot be empty when field is required`);
      return;
    }
    descriptor.defaultValue = normalized.length > 0 ? normalized : null;
    return;
  }

  if (descriptor.type === "reference-multi") {
    if (!Array.isArray(rawValue)) {
      details.push(`${pathLabel}.defaultValue must be an array of string ids or null`);
      return;
    }

    const normalized = [];
    const seen = new Set();
    for (const [index, value] of rawValue.entries()) {
      if (typeof value !== "string") {
        details.push(`${pathLabel}.defaultValue[${index}] must be a string`);
        return;
      }
      const token = value.trim();
      if (token.length === 0 || seen.has(token)) {
        continue;
      }
      seen.add(token);
      normalized.push(token);
    }
    if (descriptor.required === true && normalized.length === 0) {
      details.push(`${pathLabel}.defaultValue must include at least one id when field is required`);
      return;
    }

    descriptor.defaultValue = normalized;
  }
}

function normalizeProfileFieldDescriptor(field, pathLabel, details) {
  if (!field || typeof field !== "object" || Array.isArray(field)) {
    details.push(`${pathLabel} must be an object`);
    return null;
  }

  const id = `${field.id ?? ""}`.trim();
  const label = `${field.label ?? ""}`.trim();
  const type = `${field.type ?? ""}`.trim().toLowerCase();
  const required =
    field.required === undefined
      ? false
      : typeof field.required === "boolean"
        ? field.required
        : null;

  if (!isCollectionFieldId(id)) {
    details.push(`${pathLabel}.id must be ${COLLECTION_FIELD_ID_PATTERN_LABEL}`);
  }
  if (label.length === 0) {
    details.push(`${pathLabel}.label is required`);
  }
  if (!isSupportedProfileFieldType(type)) {
    details.push(
      `${pathLabel}.type must be one of: ${SUPPORTED_COLLECTION_FIELD_TYPES_LABEL}`
    );
  }
  if (required === null) {
    details.push(`${pathLabel}.required must be a boolean when provided`);
  }

  const descriptor = {
    id,
    label,
    type,
    required: required === null ? false : required
  };

  if (type === "text") {
    const minLength =
      field.minLength === undefined
        ? null
        : Number.isInteger(field.minLength) && field.minLength >= 0
          ? field.minLength
          : null;
    const maxLength =
      field.maxLength === undefined
        ? null
        : Number.isInteger(field.maxLength) && field.maxLength >= 0
          ? field.maxLength
          : null;

    if (field.minLength !== undefined && minLength === null) {
      details.push(`${pathLabel}.minLength must be an integer >= 0 when provided`);
    }
    if (field.maxLength !== undefined && maxLength === null) {
      details.push(`${pathLabel}.maxLength must be an integer >= 0 when provided`);
    }
    if (
      Number.isInteger(minLength) &&
      Number.isInteger(maxLength) &&
      maxLength < minLength
    ) {
      details.push(`${pathLabel}.maxLength must be greater than or equal to minLength`);
    }

    descriptor.minLength = minLength;
    descriptor.maxLength = maxLength;
  }

  const fieldTypePlugin = resolveCollectionFieldTypePlugin(type);
  if (
    fieldTypePlugin &&
    typeof fieldTypePlugin.normalizeDescriptorConstraints === "function"
  ) {
    const normalizedConstraints =
      fieldTypePlugin.normalizeDescriptorConstraints(field, { strict: true });

    if (!normalizedConstraints || normalizedConstraints.ok !== true) {
      const reason =
        typeof normalizedConstraints?.reason === "string"
          ? normalizedConstraints.reason
          : "minLength/maxLength configuration is invalid";
      const reasonField =
        typeof normalizedConstraints?.field === "string" &&
        normalizedConstraints.field.length > 0
          ? normalizedConstraints.field
          : reason.startsWith("maxLength ")
            ? "maxLength"
            : reason.startsWith("minLength ")
              ? "minLength"
              : "constraints";
      const normalizedReason =
        reason.startsWith(`${reasonField} `)
          ? reason.slice(`${reasonField} `.length)
          : reason;
      details.push(`${pathLabel}.${reasonField} ${normalizedReason}`);
    }

    if (
      normalizedConstraints?.descriptorPatch &&
      typeof normalizedConstraints.descriptorPatch === "object" &&
      !Array.isArray(normalizedConstraints.descriptorPatch)
    ) {
      Object.assign(descriptor, normalizedConstraints.descriptorPatch);
    }

    descriptor.minLength = Number.isInteger(normalizedConstraints?.minLength)
      ? normalizedConstraints.minLength
      : null;
    descriptor.maxLength = Number.isInteger(normalizedConstraints?.maxLength)
      ? normalizedConstraints.maxLength
      : null;
  }

  if (type === "number") {
    const min =
      field.min === undefined ? null : Number.isFinite(field.min) ? field.min : null;
    const max =
      field.max === undefined ? null : Number.isFinite(field.max) ? field.max : null;

    if (field.min !== undefined && min === null) {
      details.push(`${pathLabel}.min must be a finite number when provided`);
    }
    if (field.max !== undefined && max === null) {
      details.push(`${pathLabel}.max must be a finite number when provided`);
    }
    if (Number.isFinite(min) && Number.isFinite(max) && max < min) {
      details.push(`${pathLabel}.max must be greater than or equal to min`);
    }

    descriptor.min = min;
    descriptor.max = max;
  }

  if (type === "enum" || type === "enum-multi") {
    const options = normalizeProfileOptionValues(field.options, details, `${pathLabel}.options`);
    if (options === null) {
      details.push(`${pathLabel}.options is required for type '${type}'`);
    }
    descriptor.options = Array.isArray(options) ? options : [];
  }

  if (type === "reference" || type === "reference-multi") {
    const collectionId = `${field.collectionId ?? ""}`.trim().toLowerCase();
    if (!isKebabCaseIdentifier(collectionId)) {
      details.push(`${pathLabel}.collectionId must match kebab-case pattern`);
    }
    descriptor.collectionId = collectionId;
  }

  if (type === "computed") {
    const source = `${field.source ?? ""}`.trim();
    if (!isCollectionFieldId(source)) {
      details.push(`${pathLabel}.source must be ${COLLECTION_FIELD_ID_PATTERN_LABEL}`);
    }

    const resolverSourceKey =
      field.resolver !== undefined
        ? "resolver"
        : field.transform !== undefined
          ? "transform"
          : "resolver";
    const resolverInput =
      field.resolver !== undefined ? field.resolver : field.transform;
    const resolver =
      resolverInput === undefined
        ? DEFAULT_COMPUTED_RESOLVER
        : normalizeComputedResolverToken(resolverInput);
    if (!isSupportedComputedResolverToken(resolver)) {
      details.push(
        `${pathLabel}.${resolverSourceKey} must be one of: ${SUPPORTED_COMPUTED_RESOLVERS_LABEL}`
      );
    }

    descriptor.source = source;
    descriptor.resolver = isSupportedComputedResolverToken(resolver)
      ? resolver
      : DEFAULT_COMPUTED_RESOLVER;
    // Keep legacy transform key for compatibility with existing runtime descriptors.
    descriptor.transform = descriptor.resolver;

    if (field.settings !== undefined) {
      if (
        !field.settings ||
        typeof field.settings !== "object" ||
        Array.isArray(field.settings)
      ) {
        details.push(`${pathLabel}.settings must be an object when provided`);
      } else {
        const normalizedSettings = {};
        for (const [rawOptionKey, rawSettingFieldId] of Object.entries(field.settings)) {
          const optionKey =
            typeof rawOptionKey === "string" ? rawOptionKey.trim() : "";
          const settingFieldId =
            typeof rawSettingFieldId === "string" ? rawSettingFieldId.trim() : "";
          if (optionKey.length === 0) {
            details.push(`${pathLabel}.settings option key must be non-empty`);
            continue;
          }
          if (settingFieldId.length === 0) {
            details.push(
              `${pathLabel}.settings.${optionKey} must reference a non-empty setting field id`
            );
            continue;
          }
          if (
            !resolveComputedResolverSettingOptionSchema(
              descriptor.resolver,
              optionKey
            )
          ) {
            details.push(
              `${pathLabel}.settings.${optionKey} is not supported for resolver '${descriptor.resolver}'`
            );
            continue;
          }

          normalizedSettings[optionKey] = settingFieldId;
        }

        if (Object.keys(normalizedSettings).length > 0) {
          descriptor.settings = normalizedSettings;
        }
      }
    }
  }

  const resolvedDefault = resolveProfileFieldDefaultValue(field, pathLabel, details);
  if (resolvedDefault.hasDefault) {
    normalizeProfileFieldDefaultValue(descriptor, resolvedDefault.value, pathLabel, details);
  }

  return descriptor;
}

function normalizeProfileExtraFieldDescriptor(field, collectionIndex, fieldIndex, details) {
  const pathLabel = `profile.collections[${collectionIndex}].extraFields[${fieldIndex}]`;
  return normalizeProfileFieldDescriptor(field, pathLabel, details);
}

export { normalizeProfileExtraFieldDescriptor, normalizeProfileFieldDescriptor };

