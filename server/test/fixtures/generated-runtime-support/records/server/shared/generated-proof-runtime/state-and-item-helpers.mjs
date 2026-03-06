import {
  DEFAULT_COMPUTED_RESOLVER,
  createComputedResolverRegistry,
  normalizeComputedResolverSettingOptionValue,
  normalizeComputedResolverToken
} from "../../../shared/computed-resolver-catalog.mjs";
import {
  cloneFieldValue,
  normalizeFieldStoredValue
} from "./field-value-normalizers.mjs";
import { escapeRegex } from "./shared-utils.mjs";

const COMPUTED_RESOLVER_REGISTRY = createComputedResolverRegistry({
  slugifyMaxLength: 80
});

function parseItemSequence(itemId, idPrefix) {
  if (typeof itemId !== "string") {
    return 0;
  }

  const pattern = new RegExp(`^${escapeRegex(idPrefix)}-(\\d+)$`);
  const match = pattern.exec(itemId);
  if (!match) {
    return 0;
  }

  const value = Number.parseInt(match[1], 10);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function applyComputedResolver(
  sourceValue,
  resolver = DEFAULT_COMPUTED_RESOLVER,
  options = undefined
) {
  if (typeof sourceValue !== "string") {
    return null;
  }

  const normalizedSource = sourceValue.trim();
  if (normalizedSource.length === 0) {
    return null;
  }

  const resolvedKey = normalizeComputedResolverToken(resolver) ?? DEFAULT_COMPUTED_RESOLVER;
  const compute =
    COMPUTED_RESOLVER_REGISTRY[resolvedKey] ??
    COMPUTED_RESOLVER_REGISTRY[DEFAULT_COMPUTED_RESOLVER];
  return compute(normalizedSource, options);
}

function resolveComputedResolverOptions(computedField, moduleSettingsValues = null) {
  if (
    !computedField?.settings ||
    typeof computedField.settings !== "object" ||
    Array.isArray(computedField.settings)
  ) {
    return null;
  }

  const resolvedOptions = {};
  for (const [optionKey, settingFieldId] of Object.entries(computedField.settings)) {
    if (typeof settingFieldId !== "string" || settingFieldId.length === 0) {
      continue;
    }

    const rawSettingValue = resolveModuleSettingsValueByPath(
      moduleSettingsValues,
      settingFieldId
    );
    const normalizedOptionValue = normalizeComputedResolverSettingOptionValue(
      computedField.resolver,
      optionKey,
      rawSettingValue
    );
    if (normalizedOptionValue === null) {
      continue;
    }

    resolvedOptions[optionKey] = normalizedOptionValue;
  }

  return Object.keys(resolvedOptions).length > 0 ? resolvedOptions : null;
}

function resolveModuleSettingsValueByPath(moduleSettingsValues, settingPath) {
  if (!moduleSettingsValues || typeof moduleSettingsValues !== "object") {
    return undefined;
  }

  const normalizedPath =
    typeof settingPath === "string" ? settingPath.trim() : "";
  if (normalizedPath.length === 0) {
    return undefined;
  }

  const pathSegments = normalizedPath
    .split(".")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  if (pathSegments.length === 0) {
    return undefined;
  }

  let cursor = moduleSettingsValues;
  for (const segment of pathSegments) {
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) {
      return undefined;
    }
    if (!Object.prototype.hasOwnProperty.call(cursor, segment)) {
      return undefined;
    }
    cursor = cursor[segment];
  }

  return cursor;
}

function applyComputedFields(nextItem, definition, options = {}) {
  const moduleSettingsValues =
    options && typeof options === "object" ? options.moduleSettingsValues : null;
  for (const computedField of definition.computedFields) {
    const sourceValue = nextItem?.[computedField.source];
    const resolverOptions = resolveComputedResolverOptions(
      computedField,
      moduleSettingsValues
    );
    nextItem[computedField.id] = applyComputedResolver(
      sourceValue,
      computedField.resolver,
      resolverOptions ?? undefined
    );
  }

  return nextItem;
}

function normalizeWorkingState(rawState, definitions, fallbackState = null, options = {}) {
  const source =
    rawState && typeof rawState === "object" && !Array.isArray(rawState)
      ? rawState
      : fallbackState && typeof fallbackState === "object" && !Array.isArray(fallbackState)
        ? fallbackState
        : {};
  const fallback =
    fallbackState && typeof fallbackState === "object" && !Array.isArray(fallbackState)
      ? fallbackState
      : {};
  const normalized = {};

  for (const definition of definitions) {
    const fallbackItems = Array.isArray(fallback[definition.stateKey])
      ? fallback[definition.stateKey]
      : [];
    const sourceItems = Array.isArray(source[definition.stateKey])
      ? source[definition.stateKey]
      : fallbackItems;
    const items = sourceItems
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }

        const id = typeof entry.id === "string" ? entry.id : "";
        const primaryFieldId =
          typeof definition.primaryField === "string" && definition.primaryField.length > 0
            ? definition.primaryField
            : "title";
        const primaryFieldValue =
          typeof entry[primaryFieldId] === "string" ? entry[primaryFieldId].trim() : "";
        if (id.length === 0 || primaryFieldValue.length === 0) {
          return null;
        }

        const nextItem = {
          id
        };
        for (const fieldDescriptor of definition.mutableFieldDescriptors) {
          nextItem[fieldDescriptor.id] = normalizeFieldStoredValue(
            fieldDescriptor,
            entry[fieldDescriptor.id]
          );
        }

        return applyComputedFields(
          nextItem,
          definition,
          options
        );
      })
      .filter(Boolean);

    const maxSequence = items.reduce(
      (maxValue, item) =>
        Math.max(maxValue, parseItemSequence(item.id, definition.idPrefix)),
      0
    );
    const sequenceKeys = [
      definition.sequenceKey,
      ...(Array.isArray(definition.sequenceKeyAliases) ? definition.sequenceKeyAliases : [])
    ];
    const sourceNextFromState = sequenceKeys.find(
      (key) => Number.isInteger(source[key]) && source[key] > 0
    );
    const sourceNextFromFallback = sequenceKeys.find(
      (key) => Number.isInteger(fallback[key]) && fallback[key] > 0
    );
    const sourceNext =
      sourceNextFromState !== undefined
        ? source[sourceNextFromState]
        : sourceNextFromFallback !== undefined
          ? fallback[sourceNextFromFallback]
          : 1;

    normalized[definition.stateKey] = items;
    normalized[definition.sequenceKey] = Math.max(sourceNext, maxSequence + 1);
  }

  return normalized;
}

function nextCollectionItemId(workingState, definition) {
  const value = Number.isInteger(workingState[definition.sequenceKey])
    ? workingState[definition.sequenceKey]
    : 1;
  const itemId = `${definition.idPrefix}-${String(value).padStart(3, "0")}`;
  workingState[definition.sequenceKey] = value + 1;
  return itemId;
}

function toCreateNext(workingState, definition, value, options = {}) {
  const next = {
    id: nextCollectionItemId(workingState, definition)
  };

  for (const fieldDescriptor of definition.mutableFieldDescriptors) {
    next[fieldDescriptor.id] = cloneFieldValue(fieldDescriptor, value[fieldDescriptor.id]);
  }

  return applyComputedFields(
    next,
    definition,
    options
  );
}

function toUpdateNext(currentItem, body, value, definition, options = {}) {
  const next = {
    id: currentItem.id
  };

  for (const fieldDescriptor of definition.mutableFieldDescriptors) {
    const hasUpdateValue = body[fieldDescriptor.id] !== undefined;
    const sourceValue = hasUpdateValue ? value[fieldDescriptor.id] : currentItem[fieldDescriptor.id];
    next[fieldDescriptor.id] = cloneFieldValue(fieldDescriptor, sourceValue);
  }

  return applyComputedFields(
    next,
    definition,
    options
  );
}

export {
  applyComputedFields,
  normalizeWorkingState,
  toCreateNext,
  toUpdateNext
};
