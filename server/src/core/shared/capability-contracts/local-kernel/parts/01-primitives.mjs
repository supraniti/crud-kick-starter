const STRUCTURED_PROPERTY_ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
const STRUCTURED_PROPERTY_TYPES = Object.freeze([
  "text",
  "number",
  "boolean",
  "enum",
  "string-list",
  "group"
]);
const STRUCTURED_PROPERTY_TYPE_SET = new Set(STRUCTURED_PROPERTY_TYPES);
const STRUCTURED_PROPERTY_ALLOWED_KEYS = new Set([
  "id",
  "label",
  "type",
  "required",
  "minLength",
  "maxLength",
  "min",
  "max",
  "minItems",
  "maxItems",
  "options",
  "properties"
]);
const STRUCTURED_INVALID_VALUE = "__STRUCTURED_INVALID__";
const DEFAULT_OBJECT_ARRAY_ITEM_LABEL = "item";

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function cloneStructuredValue(value) {
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

function normalizeNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function normalizeFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeStructuredPropertyType(value) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim().toLowerCase();
  return STRUCTURED_PROPERTY_TYPE_SET.has(normalized) ? normalized : "";
}

function normalizeEnumOptions(rawOptions = [], { strict = false, path = "options" } = {}) {
  if (!Array.isArray(rawOptions)) {
    if (strict) {
      return {
        ok: false,
        reason: `${path} must be an array of non-empty string values`
      };
    }

    return {
      ok: true,
      value: []
    };
  }

  const options = [];
  const seen = new Set();
  for (const [index, rawOption] of rawOptions.entries()) {
    const optionValue =
      typeof rawOption === "string"
        ? rawOption.trim().toLowerCase()
        : typeof rawOption?.value === "string"
          ? rawOption.value.trim().toLowerCase()
          : "";
    if (optionValue.length === 0) {
      if (strict) {
        return {
          ok: false,
          reason: `${path}[${index}] must be a non-empty string`
        };
      }
      continue;
    }

    if (seen.has(optionValue)) {
      continue;
    }
    seen.add(optionValue);
    options.push(optionValue);
  }

  if (strict && options.length === 0) {
    return {
      ok: false,
      reason: `${path} must include at least one option`
    };
  }

  return {
    ok: true,
    value: options
  };
}


function normalizeBooleanInputValue(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  if (typeof rawValue === "boolean") {
    return rawValue;
  }

  if (typeof rawValue === "number") {
    if (rawValue === 1) {
      return true;
    }
    if (rawValue === 0) {
      return false;
    }
    return STRUCTURED_INVALID_VALUE;
  }

  if (typeof rawValue === "string") {
    const normalized = rawValue.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
    return STRUCTURED_INVALID_VALUE;
  }

  return STRUCTURED_INVALID_VALUE;
}

function normalizeNumberInputValue(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  if (typeof rawValue === "number") {
    return Number.isFinite(rawValue) ? rawValue : STRUCTURED_INVALID_VALUE;
  }

  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : STRUCTURED_INVALID_VALUE;
  }

  return STRUCTURED_INVALID_VALUE;
}


export {
  DEFAULT_OBJECT_ARRAY_ITEM_LABEL,
  STRUCTURED_INVALID_VALUE,
  STRUCTURED_PROPERTY_ALLOWED_KEYS,
  STRUCTURED_PROPERTY_ID_PATTERN,
  STRUCTURED_PROPERTY_TYPES,
  cloneStructuredValue,
  isPlainObject,
  normalizeBooleanInputValue,
  normalizeEnumOptions,
  normalizeFiniteNumber,
  normalizeNonNegativeInteger,
  normalizeNumberInputValue,
  normalizeStructuredPropertyType
};
