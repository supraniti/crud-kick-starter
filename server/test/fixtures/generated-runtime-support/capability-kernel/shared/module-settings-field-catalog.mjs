const MODULE_SETTINGS_FIELD_TYPES = Object.freeze([
  "text",
  "url",
  "date",
  "number",
  "boolean",
  "enum",
  "enum-multi",
  "object"
]);

const MODULE_SETTINGS_FIELD_TYPE_SET = new Set(MODULE_SETTINGS_FIELD_TYPES);
const MODULE_SETTINGS_FIELD_TYPES_LABEL = MODULE_SETTINGS_FIELD_TYPES.join(", ");

function isSupportedModuleSettingsFieldType(value) {
  if (typeof value !== "string") {
    return false;
  }

  return MODULE_SETTINGS_FIELD_TYPE_SET.has(value.trim());
}

function isEnumModuleSettingsFieldType(value) {
  return value === "enum" || value === "enum-multi";
}

export {
  MODULE_SETTINGS_FIELD_TYPES,
  MODULE_SETTINGS_FIELD_TYPE_SET,
  MODULE_SETTINGS_FIELD_TYPES_LABEL,
  isEnumModuleSettingsFieldType,
  isSupportedModuleSettingsFieldType
};
