const REFERENCE_UI_ALLOWED_KEYS = new Set([
  "inlineCreate",
  "optionsFilter",
  "visibleWhen",
  "inlineCreateDefaults"
]);
const REFERENCE_UI_FILTER_ALLOWED_KEYS = new Set(["fieldId", "sourceFieldId", "value"]);
const REFERENCE_UI_VISIBLE_WHEN_ALLOWED_KEYS = new Set([
  "sourceFieldId",
  "collectionId",
  "matchField",
  "valueField",
  "equals"
]);

function createReferenceUiDefinitionNormalizer({
  collectionFieldIdPatternLabel,
  isCollectionFieldId,
  routeSegmentPattern,
  validationError
}) {
  const deps = {
    collectionFieldIdPatternLabel,
    isCollectionFieldId,
    routeSegmentPattern,
    validationError
  };

  const normalizeReferenceUiFilterDefinition = (rawFilter, fieldPath) =>
    normalizeReferenceUiFilterDefinitionWithDeps(rawFilter, fieldPath, deps);
  const normalizeReferenceUiVisibleWhenDefinition = (rawVisibleWhen, fieldPath) =>
    normalizeReferenceUiVisibleWhenDefinitionWithDeps(rawVisibleWhen, fieldPath, deps);
  const normalizeReferenceUiInlineCreateDefaults = (rawDefaults, fieldPath) =>
    normalizeReferenceUiInlineCreateDefaultsWithDeps(rawDefaults, fieldPath, deps);
  const normalizeReferenceUiDefinition = (rawReferenceUi, fieldPath) =>
    normalizeReferenceUiDefinitionWithDeps(rawReferenceUi, fieldPath, {
      ...deps,
      normalizeReferenceUiFilterDefinition,
      normalizeReferenceUiVisibleWhenDefinition,
      normalizeReferenceUiInlineCreateDefaults
    });

  return {
    normalizeReferenceUiFilterDefinition,
    normalizeReferenceUiVisibleWhenDefinition,
    normalizeReferenceUiInlineCreateDefaults,
    normalizeReferenceUiDefinition
  };
}

function normalizeReferenceUiFilterDefinitionWithDeps(rawFilter, fieldPath, deps) {
  if (!rawFilter || typeof rawFilter !== "object" || Array.isArray(rawFilter)) {
    return {
      ok: false,
      error: deps.validationError(
        "MODULE_MANIFEST_INVALID",
        "Collection referenceUi optionsFilter must be an object when provided",
        fieldPath
      )
    };
  }

  const unknownFilterKey = Object.keys(rawFilter).find(
    (key) => !REFERENCE_UI_FILTER_ALLOWED_KEYS.has(key)
  );
  if (unknownFilterKey) {
    return {
      ok: false,
      error: deps.validationError(
        "MODULE_MANIFEST_INVALID",
        `Collection referenceUi optionsFilter field '${unknownFilterKey}' is not supported`,
        `${fieldPath}.${unknownFilterKey}`
      )
    };
  }

  const fieldId = typeof rawFilter.fieldId === "string" ? rawFilter.fieldId.trim() : "";
  if (!deps.isCollectionFieldId(fieldId)) {
    return {
      ok: false,
      error: deps.validationError(
        "MODULE_MANIFEST_INVALID",
        `Collection referenceUi optionsFilter fieldId must be ${deps.collectionFieldIdPatternLabel}`,
        `${fieldPath}.fieldId`
      )
    };
  }

  const hasSourceFieldId = Object.prototype.hasOwnProperty.call(rawFilter, "sourceFieldId");
  const hasValue = Object.prototype.hasOwnProperty.call(rawFilter, "value");
  if (hasSourceFieldId === hasValue) {
    return {
      ok: false,
      error: deps.validationError(
        "MODULE_MANIFEST_INVALID",
        "Collection referenceUi optionsFilter must provide exactly one of sourceFieldId or value",
        fieldPath
      )
    };
  }

  const normalized = { fieldId };
  if (hasSourceFieldId) {
    const sourceFieldId =
      typeof rawFilter.sourceFieldId === "string" ? rawFilter.sourceFieldId.trim() : "";
    if (!deps.isCollectionFieldId(sourceFieldId)) {
      return {
        ok: false,
        error: deps.validationError(
          "MODULE_MANIFEST_INVALID",
          `Collection referenceUi optionsFilter sourceFieldId must be ${deps.collectionFieldIdPatternLabel}`,
          `${fieldPath}.sourceFieldId`
        )
      };
    }
    normalized.sourceFieldId = sourceFieldId;
  } else {
    normalized.value = rawFilter.value ?? null;
  }

  return {
    ok: true,
    value: normalized
  };
}

function normalizeReferenceUiVisibleWhenDefinitionWithDeps(rawVisibleWhen, fieldPath, deps) {
  if (!rawVisibleWhen || typeof rawVisibleWhen !== "object" || Array.isArray(rawVisibleWhen)) {
    return {
      ok: false,
      error: deps.validationError(
        "MODULE_MANIFEST_INVALID",
        "Collection referenceUi visibleWhen must be an object when provided",
        fieldPath
      )
    };
  }

  const unknownVisibleWhenKey = Object.keys(rawVisibleWhen).find(
    (key) => !REFERENCE_UI_VISIBLE_WHEN_ALLOWED_KEYS.has(key)
  );
  if (unknownVisibleWhenKey) {
    return {
      ok: false,
      error: deps.validationError(
        "MODULE_MANIFEST_INVALID",
        `Collection referenceUi visibleWhen field '${unknownVisibleWhenKey}' is not supported`,
        `${fieldPath}.${unknownVisibleWhenKey}`
      )
    };
  }

  const sourceFieldId =
    typeof rawVisibleWhen.sourceFieldId === "string" ? rawVisibleWhen.sourceFieldId.trim() : "";
  if (!deps.isCollectionFieldId(sourceFieldId)) {
    return {
      ok: false,
      error: deps.validationError(
        "MODULE_MANIFEST_INVALID",
        `Collection referenceUi visibleWhen sourceFieldId must be ${deps.collectionFieldIdPatternLabel}`,
        `${fieldPath}.sourceFieldId`
      )
    };
  }

  const valueField = typeof rawVisibleWhen.valueField === "string" ? rawVisibleWhen.valueField.trim() : "";
  if (!deps.isCollectionFieldId(valueField)) {
    return {
      ok: false,
      error: deps.validationError(
        "MODULE_MANIFEST_INVALID",
        `Collection referenceUi visibleWhen valueField must be ${deps.collectionFieldIdPatternLabel}`,
        `${fieldPath}.valueField`
      )
    };
  }

  const collectionId =
    typeof rawVisibleWhen.collectionId === "string" ? rawVisibleWhen.collectionId.trim() : "";
  if (!deps.routeSegmentPattern.test(collectionId)) {
    return {
      ok: false,
      error: deps.validationError(
        "MODULE_MANIFEST_INVALID",
        "Collection referenceUi visibleWhen collectionId must be lowercase kebab-case",
        `${fieldPath}.collectionId`
      )
    };
  }

  const matchField =
    typeof rawVisibleWhen.matchField === "string" ? rawVisibleWhen.matchField.trim() : "id";
  if (!deps.isCollectionFieldId(matchField)) {
    return {
      ok: false,
      error: deps.validationError(
        "MODULE_MANIFEST_INVALID",
        `Collection referenceUi visibleWhen matchField must be ${deps.collectionFieldIdPatternLabel}`,
        `${fieldPath}.matchField`
      )
    };
  }

  return {
    ok: true,
    value: {
      sourceFieldId,
      collectionId,
      matchField,
      valueField,
      equals: rawVisibleWhen.equals ?? true
    }
  };
}

function normalizeReferenceUiInlineCreateDefaultsWithDeps(rawDefaults, fieldPath, deps) {
  if (!Array.isArray(rawDefaults)) {
    return {
      ok: false,
      error: deps.validationError(
        "MODULE_MANIFEST_INVALID",
        "Collection referenceUi inlineCreateDefaults must be an array when provided",
        fieldPath
      )
    };
  }

  const normalizedDefaults = [];
  for (const [index, rawDefault] of rawDefaults.entries()) {
    const defaultPath = `${fieldPath}.${index}`;
    if (!rawDefault || typeof rawDefault !== "object" || Array.isArray(rawDefault)) {
      return {
        ok: false,
        error: deps.validationError(
          "MODULE_MANIFEST_INVALID",
          "Collection referenceUi inlineCreateDefaults entries must be objects",
          defaultPath
        )
      };
    }

    const unknownDefaultKey = Object.keys(rawDefault).find(
      (key) => !REFERENCE_UI_FILTER_ALLOWED_KEYS.has(key)
    );
    if (unknownDefaultKey) {
      return {
        ok: false,
        error: deps.validationError(
          "MODULE_MANIFEST_INVALID",
          `Collection referenceUi inlineCreateDefaults field '${unknownDefaultKey}' is not supported`,
          `${defaultPath}.${unknownDefaultKey}`
        )
      };
    }

    const fieldId = typeof rawDefault.fieldId === "string" ? rawDefault.fieldId.trim() : "";
    if (!deps.isCollectionFieldId(fieldId)) {
      return {
        ok: false,
        error: deps.validationError(
          "MODULE_MANIFEST_INVALID",
          `Collection referenceUi inlineCreateDefaults fieldId must be ${deps.collectionFieldIdPatternLabel}`,
          `${defaultPath}.fieldId`
        )
      };
    }

    const hasSourceFieldId = Object.prototype.hasOwnProperty.call(rawDefault, "sourceFieldId");
    const hasValue = Object.prototype.hasOwnProperty.call(rawDefault, "value");
    if (hasSourceFieldId === hasValue) {
      return {
        ok: false,
        error: deps.validationError(
          "MODULE_MANIFEST_INVALID",
          "Collection referenceUi inlineCreateDefaults entries must provide exactly one of sourceFieldId or value",
          defaultPath
        )
      };
    }

    const normalizedDefault = { fieldId };
    if (hasSourceFieldId) {
      const sourceFieldId =
        typeof rawDefault.sourceFieldId === "string" ? rawDefault.sourceFieldId.trim() : "";
      if (!deps.isCollectionFieldId(sourceFieldId)) {
        return {
          ok: false,
          error: deps.validationError(
            "MODULE_MANIFEST_INVALID",
            `Collection referenceUi inlineCreateDefaults sourceFieldId must be ${deps.collectionFieldIdPatternLabel}`,
            `${defaultPath}.sourceFieldId`
          )
        };
      }
      normalizedDefault.sourceFieldId = sourceFieldId;
    } else {
      normalizedDefault.value = rawDefault.value ?? null;
    }

    normalizedDefaults.push(normalizedDefault);
  }

  return {
    ok: true,
    value: normalizedDefaults
  };
}

function normalizeReferenceUiDefinitionWithDeps(rawReferenceUi, fieldPath, deps) {
  if (!rawReferenceUi || typeof rawReferenceUi !== "object" || Array.isArray(rawReferenceUi)) {
    return {
      ok: false,
      error: deps.validationError(
        "MODULE_MANIFEST_INVALID",
        "Collection referenceUi must be an object when provided",
        fieldPath
      )
    };
  }

  const unknownReferenceUiKey = Object.keys(rawReferenceUi).find(
    (key) => !REFERENCE_UI_ALLOWED_KEYS.has(key)
  );
  if (unknownReferenceUiKey) {
    return {
      ok: false,
      error: deps.validationError(
        "MODULE_MANIFEST_INVALID",
        `Collection referenceUi field '${unknownReferenceUiKey}' is not supported`,
        `${fieldPath}.${unknownReferenceUiKey}`
      )
    };
  }

  const normalized = {};
  if (rawReferenceUi.inlineCreate !== undefined) {
    if (typeof rawReferenceUi.inlineCreate !== "boolean") {
      return {
        ok: false,
        error: deps.validationError(
          "MODULE_MANIFEST_INVALID",
          "Collection referenceUi inlineCreate must be a boolean when provided",
          `${fieldPath}.inlineCreate`
        )
      };
    }
    normalized.inlineCreate = rawReferenceUi.inlineCreate;
  }

  if (rawReferenceUi.optionsFilter !== undefined) {
    const optionsFilter = deps.normalizeReferenceUiFilterDefinition(
      rawReferenceUi.optionsFilter,
      `${fieldPath}.optionsFilter`
    );
    if (!optionsFilter.ok) {
      return optionsFilter;
    }
    normalized.optionsFilter = optionsFilter.value;
  }

  if (rawReferenceUi.visibleWhen !== undefined) {
    const visibleWhen = deps.normalizeReferenceUiVisibleWhenDefinition(
      rawReferenceUi.visibleWhen,
      `${fieldPath}.visibleWhen`
    );
    if (!visibleWhen.ok) {
      return visibleWhen;
    }
    normalized.visibleWhen = visibleWhen.value;
  }

  if (rawReferenceUi.inlineCreateDefaults !== undefined) {
    const inlineCreateDefaults = deps.normalizeReferenceUiInlineCreateDefaults(
      rawReferenceUi.inlineCreateDefaults,
      `${fieldPath}.inlineCreateDefaults`
    );
    if (!inlineCreateDefaults.ok) {
      return inlineCreateDefaults;
    }
    normalized.inlineCreateDefaults = inlineCreateDefaults.value;
  }

  return {
    ok: true,
    value: normalized
  };
}

export { createReferenceUiDefinitionNormalizer };
