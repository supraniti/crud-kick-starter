import { MODULE_SETTINGS_FIELD_TYPE_SET as MODULE_SETTINGS_FIELD_TYPES } from "../../shared/capability-contracts/module-settings-field-catalog.js";
const MODULE_SETTINGS_CONTRACT_VERSION = 1;

function cloneValue(value) {
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

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function createDiagnostic(code, message, details = {}) {
  return {
    code,
    message,
    ...details
  };
}

function firstUnknownKey(input, allowedKeys) {
  return Object.keys(input ?? {}).find((key) => !allowedKeys.has(key)) ?? null;
}

export {
  MODULE_SETTINGS_CONTRACT_VERSION,
  MODULE_SETTINGS_FIELD_TYPES,
  cloneValue,
  createDiagnostic,
  firstUnknownKey,
  isObject
};

