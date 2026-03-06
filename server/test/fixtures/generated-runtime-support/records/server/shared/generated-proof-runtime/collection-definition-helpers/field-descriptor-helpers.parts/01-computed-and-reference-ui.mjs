import {
  normalizeComputedResolverToken,
  resolveComputedResolverSettingOptionSchema
} from "../../../../../shared/computed-resolver-catalog.mjs";

function resolveComputedResolverToken(field = {}) {
  const resolver = normalizeComputedResolverToken(field.resolver);
  if (resolver !== null) {
    return resolver;
  }

  return normalizeComputedResolverToken(field.transform);
}

function normalizeComputedResolverSettings(field = {}, resolver) {
  if (!Object.prototype.hasOwnProperty.call(field, "settings")) {
    return {
      ok: true,
      settings: null
    };
  }

  const rawSettings = field.settings;
  if (!rawSettings || typeof rawSettings !== "object" || Array.isArray(rawSettings)) {
    return {
      ok: false,
      reason: "computed settings must be an object when provided"
    };
  }

  const normalizedSettings = {};
  for (const [rawOptionKey, rawSettingFieldId] of Object.entries(rawSettings)) {
    const optionKey = typeof rawOptionKey === "string" ? rawOptionKey.trim() : "";
    const settingFieldId =
      typeof rawSettingFieldId === "string" ? rawSettingFieldId.trim() : "";
    if (optionKey.length === 0) {
      return {
        ok: false,
        reason: "computed settings option key must be non-empty"
      };
    }
    if (settingFieldId.length === 0) {
      return {
        ok: false,
        reason: `computed settings option '${optionKey}' must reference a non-empty setting id`
      };
    }
    if (!resolveComputedResolverSettingOptionSchema(resolver, optionKey)) {
      return {
        ok: false,
        reason: `computed settings option '${optionKey}' is not supported for resolver '${resolver}'`
      };
    }

    normalizedSettings[optionKey] = settingFieldId;
  }

  return {
    ok: true,
    settings:
      Object.keys(normalizedSettings).length > 0 ? normalizedSettings : null
  };
}

function resolveNormalizedReferenceOptionsFilter(rawReferenceUi) {
  const optionsFilter = rawReferenceUi.optionsFilter;
  if (!optionsFilter || typeof optionsFilter !== "object" || Array.isArray(optionsFilter)) {
    return null;
  }

  const fieldId = typeof optionsFilter.fieldId === "string" ? optionsFilter.fieldId.trim() : "";
  if (fieldId.length === 0) {
    return null;
  }

  if (typeof optionsFilter.sourceFieldId === "string" && optionsFilter.sourceFieldId.trim().length > 0) {
    return {
      fieldId,
      sourceFieldId: optionsFilter.sourceFieldId.trim()
    };
  }

  return {
    fieldId,
    value: optionsFilter.value ?? null
  };
}

function resolveNormalizedReferenceVisibleWhen(rawReferenceUi) {
  const visibleWhen = rawReferenceUi.visibleWhen;
  if (!visibleWhen || typeof visibleWhen !== "object" || Array.isArray(visibleWhen)) {
    return null;
  }

  const sourceFieldId =
    typeof visibleWhen.sourceFieldId === "string" ? visibleWhen.sourceFieldId.trim() : "";
  const collectionId =
    typeof visibleWhen.collectionId === "string" ? visibleWhen.collectionId.trim() : "";
  const valueField =
    typeof visibleWhen.valueField === "string" ? visibleWhen.valueField.trim() : "";
  const matchField =
    typeof visibleWhen.matchField === "string" && visibleWhen.matchField.trim().length > 0
      ? visibleWhen.matchField.trim()
      : "id";
  if (sourceFieldId.length === 0 || collectionId.length === 0 || valueField.length === 0) {
    return null;
  }

  return {
    sourceFieldId,
    collectionId,
    matchField,
    valueField,
    equals: visibleWhen.equals ?? true
  };
}

function normalizeInlineCreateDefaultEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }

  const fieldId = typeof entry.fieldId === "string" ? entry.fieldId.trim() : "";
  if (fieldId.length === 0) {
    return null;
  }

  if (typeof entry.sourceFieldId === "string" && entry.sourceFieldId.trim().length > 0) {
    return {
      fieldId,
      sourceFieldId: entry.sourceFieldId.trim()
    };
  }

  return {
    fieldId,
    value: entry.value ?? null
  };
}

function resolveNormalizedInlineCreateDefaults(rawReferenceUi) {
  if (!Array.isArray(rawReferenceUi.inlineCreateDefaults)) {
    return null;
  }

  const inlineCreateDefaults = rawReferenceUi.inlineCreateDefaults
    .map((entry) => normalizeInlineCreateDefaultEntry(entry))
    .filter(Boolean);
  return inlineCreateDefaults.length > 0 ? inlineCreateDefaults : null;
}

function normalizeReferenceUiDescriptor(field = {}) {
  const rawReferenceUi = field.referenceUi;
  if (!rawReferenceUi || typeof rawReferenceUi !== "object" || Array.isArray(rawReferenceUi)) {
    return null;
  }

  const normalized = {};
  if (typeof rawReferenceUi.inlineCreate === "boolean") {
    normalized.inlineCreate = rawReferenceUi.inlineCreate;
  }

  const optionsFilter = resolveNormalizedReferenceOptionsFilter(rawReferenceUi);
  if (optionsFilter) {
    normalized.optionsFilter = optionsFilter;
  }

  const visibleWhen = resolveNormalizedReferenceVisibleWhen(rawReferenceUi);
  if (visibleWhen) {
    normalized.visibleWhen = visibleWhen;
  }

  const inlineCreateDefaults = resolveNormalizedInlineCreateDefaults(rawReferenceUi);
  if (inlineCreateDefaults) {
    normalized.inlineCreateDefaults = inlineCreateDefaults;
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

export {
  normalizeComputedResolverSettings,
  normalizeReferenceUiDescriptor,
  resolveComputedResolverToken
};
