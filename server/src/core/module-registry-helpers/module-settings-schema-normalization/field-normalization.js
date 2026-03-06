import {
  MODULE_SETTINGS_FIELD_TYPES,
  createDiagnostic,
  firstUnknownKey,
  isObject
} from "./shared.js";
import {
  normalizeEnumOptions,
  resolveFieldDefaultRaw
} from "./parts/01-default-object-and-enum-normalization.js";
import {
  normalizeDefaultValue
} from "./parts/02-default-value-normalization.js";
import {
  createNormalizeSettingsField
} from "./parts/03-settings-field-normalization.js";

const SETTINGS_FIELD_ALLOWED_KEYS = new Set([
  "id",
  "label",
  "type",
  "required",
  "default",
  "defaultValue",
  "description",
  "options",
  "fields",
  "min",
  "max",
  "sensitive"
]);

const normalizeSettingsField = createNormalizeSettingsField({
  MODULE_SETTINGS_FIELD_TYPES,
  SETTINGS_FIELD_ALLOWED_KEYS,
  createDiagnostic,
  firstUnknownKey,
  isObject,
  normalizeEnumOptions,
  resolveFieldDefaultRaw,
  normalizeDefaultValue
});

export { normalizeSettingsField };


