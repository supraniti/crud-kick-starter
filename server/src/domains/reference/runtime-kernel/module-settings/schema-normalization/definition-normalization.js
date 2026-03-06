import { MODULE_SETTINGS_CONTRACT_VERSION, createDiagnostic, firstUnknownKey, isObject } from "./shared.js";
import { normalizeSettingsField } from "./field-normalization.js";

const SETTINGS_DEFINITION_ALLOWED_KEYS = new Set(["contractVersion", "fields"]);

function normalizeSettingsDefinition(manifest) {
  const moduleId = manifest?.id ?? "unknown";
  const settings = manifest?.settings;
  if (settings === undefined) {
    return {
      ok: true,
      value: null
    };
  }

  if (isObject(settings) && Object.keys(settings).length === 0) {
    return {
      ok: true,
      value: null
    };
  }

  if (!isObject(settings)) {
    return {
      ok: false,
      error: createDiagnostic(
        "MODULE_SETTINGS_SCHEMA_INVALID",
        `Module '${moduleId}' settings descriptor must be an object`,
        {
          moduleId
        }
      )
    };
  }

  const unknownRootField = firstUnknownKey(settings, SETTINGS_DEFINITION_ALLOWED_KEYS);
  if (unknownRootField) {
    return {
      ok: false,
      error: createDiagnostic(
        "MODULE_SETTINGS_SCHEMA_UNKNOWN_FIELD",
        `Module '${moduleId}' settings field '${unknownRootField}' is not supported`,
        {
          moduleId,
          field: `settings.${unknownRootField}`
        }
      )
    };
  }

  const contractVersion =
    settings.contractVersion === undefined
      ? MODULE_SETTINGS_CONTRACT_VERSION
      : settings.contractVersion;
  if (contractVersion !== MODULE_SETTINGS_CONTRACT_VERSION) {
    return {
      ok: false,
      error: createDiagnostic(
        "MODULE_SETTINGS_SCHEMA_INVALID",
        `Module '${moduleId}' settings contract version '${contractVersion}' is unsupported`,
        {
          moduleId
        }
      )
    };
  }

  if (!Array.isArray(settings.fields)) {
    return {
      ok: false,
      error: createDiagnostic(
        "MODULE_SETTINGS_SCHEMA_INVALID",
        `Module '${moduleId}' settings fields must be an array`,
        {
          moduleId,
          field: "settings.fields"
        }
      )
    };
  }

  const seenFieldIds = new Set();
  const fields = [];
  for (const [index, rawField] of settings.fields.entries()) {
    const normalizedField = normalizeSettingsField(
      moduleId,
      rawField,
      index,
      seenFieldIds
    );
    if (!normalizedField.ok) {
      return normalizedField;
    }
    fields.push(normalizedField.value);
  }

  if (fields.length === 0) {
    return {
      ok: true,
      value: null
    };
  }

  return {
    ok: true,
    value: {
      moduleId,
      contractVersion: MODULE_SETTINGS_CONTRACT_VERSION,
      fields
    }
  };
}

export { normalizeSettingsDefinition };
