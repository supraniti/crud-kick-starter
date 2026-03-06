import {
  DEFAULT_COMPUTED_RESOLVER,
  isSupportedComputedResolverToken
} from "../../../computed-resolver-catalog.mjs";
import {
  isReferenceCollectionFieldType,
  isSupportedCollectionFieldType
} from "../../../collection-field-catalog.mjs";
import {
  resolveCollectionFieldTypePlugin
} from "../../../collection-field-type-plugin-registry.mjs";
import { normalizeManifestEnumOptions } from "../../shared-utils.mjs";
import {
  DEFAULT_REFERENCE_COLLECTION_ID,
  REFERENCE_DELETE_POLICY_ALLOWED_VALUES
} from "./00-field-constants.mjs";
import {
  normalizeComputedResolverSettings,
  normalizeReferenceUiDescriptor,
  resolveComputedResolverToken
} from "./01-computed-and-reference-ui.mjs";
import {
  normalizeDescriptorDefaultValue,
  resolveRawFieldDefaultValue
} from "./02-default-value-normalization.mjs";

function createEmptyManifestFieldDescriptorNormalization() {
  return {
    descriptors: [],
    unsupportedTypes: [],
    unsupportedComputedResolvers: [],
    unsupportedComputedResolverSettings: [],
    unsupportedDefaultValues: []
  };
}

function resolveFieldIdAndType(field) {
  const id = typeof field.id === "string" ? field.id.trim() : "";
  const type = typeof field.type === "string" ? field.type.trim().toLowerCase() : "";
  return {
    id,
    type
  };
}

function createBaseFieldDescriptor(id, type, field) {
  return {
    id,
    type,
    required: field.required === true
  };
}

function applyTextConstraints(descriptor, field) {
  if (descriptor.type !== "text") {
    return;
  }

  descriptor.minLength =
    Number.isInteger(field.minLength) && field.minLength >= 0 ? field.minLength : null;
  descriptor.maxLength =
    Number.isInteger(field.maxLength) && field.maxLength >= 0 ? field.maxLength : null;
}

function applyPluginConstraints(descriptor, field) {
  const fieldTypePlugin = resolveCollectionFieldTypePlugin(descriptor.type);
  if (
    !fieldTypePlugin ||
    typeof fieldTypePlugin.normalizeDescriptorConstraints !== "function"
  ) {
    return;
  }

  const normalizedConstraints = fieldTypePlugin.normalizeDescriptorConstraints(field, {
    strict: false
  });
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

function applyNumberConstraints(descriptor, field) {
  if (descriptor.type !== "number") {
    return;
  }

  descriptor.min = Number.isFinite(field.min) ? field.min : null;
  descriptor.max = Number.isFinite(field.max) ? field.max : null;
  if (
    Number.isFinite(descriptor.min) &&
    Number.isFinite(descriptor.max) &&
    descriptor.max < descriptor.min
  ) {
    const swap = descriptor.min;
    descriptor.min = descriptor.max;
    descriptor.max = swap;
  }
}

function applyEnumConstraints(descriptor, field) {
  if (descriptor.type !== "enum" && descriptor.type !== "enum-multi") {
    return;
  }

  descriptor.options = normalizeManifestEnumOptions(field.options);
  descriptor.optionSet = new Set(descriptor.options);
}

function applyReferenceConstraints(descriptor, field) {
  if (!isReferenceCollectionFieldType(descriptor.type)) {
    return;
  }

  descriptor.collectionId =
    typeof field.collectionId === "string" && field.collectionId.trim().length > 0
      ? field.collectionId.trim()
      : DEFAULT_REFERENCE_COLLECTION_ID;

  if (typeof field.labelField === "string" && field.labelField.trim().length > 0) {
    descriptor.labelField = field.labelField.trim();
  }

  if (typeof field.onDelete === "string") {
    const normalizedDeletePolicy = field.onDelete.trim().toLowerCase();
    if (REFERENCE_DELETE_POLICY_ALLOWED_VALUES.has(normalizedDeletePolicy)) {
      descriptor.onDelete = normalizedDeletePolicy;
    }
  }

  if (typeof field.onDeleteSetting === "string" && field.onDeleteSetting.trim().length > 0) {
    descriptor.onDeleteSetting = field.onDeleteSetting.trim();
  }

  const referenceUi = normalizeReferenceUiDescriptor(field);
  if (referenceUi) {
    descriptor.referenceUi = referenceUi;
  }
}

function applyComputedConstraints(
  descriptor,
  field,
  {
    id,
    index,
    unsupportedComputedResolvers,
    unsupportedComputedResolverSettings
  }
) {
  if (descriptor.type !== "computed") {
    return;
  }

  descriptor.source =
    typeof field.source === "string" && field.source.trim().length > 0 ? field.source.trim() : null;

  const resolver = resolveComputedResolverToken(field);
  if (resolver !== null && !isSupportedComputedResolverToken(resolver)) {
    unsupportedComputedResolvers.push({
      id,
      resolver,
      index
    });
  }
  descriptor.resolver = resolver ?? DEFAULT_COMPUTED_RESOLVER;
  descriptor.transform = descriptor.resolver;

  const computedSettings = normalizeComputedResolverSettings(field, descriptor.resolver);
  if (!computedSettings.ok) {
    unsupportedComputedResolverSettings.push({
      id,
      reason: computedSettings.reason,
      index
    });
    return;
  }
  if (computedSettings.settings) {
    descriptor.settings = computedSettings.settings;
  }
}

function applyDescriptorDefaultValue(
  descriptor,
  field,
  {
    id,
    index,
    unsupportedDefaultValues
  }
) {
  const resolvedDefault = resolveRawFieldDefaultValue(field);
  if (!resolvedDefault.ok) {
    unsupportedDefaultValues.push({
      id,
      reason: resolvedDefault.reason,
      index
    });
    return {
      ok: false
    };
  }

  if (!resolvedDefault.hasDefault) {
    return {
      ok: true
    };
  }

  const normalizedDefault = normalizeDescriptorDefaultValue(descriptor, resolvedDefault.value);
  if (!normalizedDefault.ok) {
    unsupportedDefaultValues.push({
      id,
      reason: normalizedDefault.reason,
      index
    });
    return {
      ok: false
    };
  }

  descriptor.defaultValue = normalizedDefault.value;
  return {
    ok: true
  };
}

function normalizeManifestFieldDescriptor(field, index, summary) {
  if (!field || typeof field !== "object") {
    return;
  }

  const { id, type } = resolveFieldIdAndType(field);
  if (id.length === 0 || type.length === 0) {
    return;
  }

  if (!isSupportedCollectionFieldType(type)) {
    summary.unsupportedTypes.push({
      id,
      type,
      index
    });
    return;
  }

  const descriptor = createBaseFieldDescriptor(id, type, field);
  applyTextConstraints(descriptor, field);
  applyPluginConstraints(descriptor, field);
  applyNumberConstraints(descriptor, field);
  applyEnumConstraints(descriptor, field);
  applyReferenceConstraints(descriptor, field);
  applyComputedConstraints(descriptor, field, {
    id,
    index,
    unsupportedComputedResolvers: summary.unsupportedComputedResolvers,
    unsupportedComputedResolverSettings: summary.unsupportedComputedResolverSettings
  });

  const defaultValueResult = applyDescriptorDefaultValue(descriptor, field, {
    id,
    index,
    unsupportedDefaultValues: summary.unsupportedDefaultValues
  });
  if (!defaultValueResult.ok) {
    return;
  }

  summary.descriptors.push(descriptor);
}

function normalizeManifestFieldDescriptors(manifestCollection) {
  if (!manifestCollection || typeof manifestCollection !== "object") {
    return createEmptyManifestFieldDescriptorNormalization();
  }

  const fields = Array.isArray(manifestCollection.fields) ? manifestCollection.fields : [];
  const summary = createEmptyManifestFieldDescriptorNormalization();

  for (let index = 0; index < fields.length; index += 1) {
    normalizeManifestFieldDescriptor(fields[index], index, summary);
  }

  return summary;
}

export { normalizeManifestFieldDescriptors };
