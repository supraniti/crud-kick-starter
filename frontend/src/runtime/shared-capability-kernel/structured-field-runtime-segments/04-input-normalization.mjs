import {
  STRUCTURED_INVALID_VALUE,
  cloneStructuredValue,
  isPlainObject,
  normalizeBooleanInputValue,
  normalizeNumberInputValue
} from "./01-primitives.mjs";

function normalizeStructuredPropertyInputValue(rawValue, property) {
  if (rawValue === undefined || rawValue === null) {
    return null;
  }

  switch (property.type) {
    case "text":
      return typeof rawValue === "string" ? rawValue.trim() : STRUCTURED_INVALID_VALUE;
    case "number":
      return normalizeNumberInputValue(rawValue);
    case "boolean":
      return normalizeBooleanInputValue(rawValue);
    case "enum":
      return typeof rawValue === "string" ? rawValue.trim().toLowerCase() : STRUCTURED_INVALID_VALUE;
    case "string-list": {
      if (!Array.isArray(rawValue)) {
        return STRUCTURED_INVALID_VALUE;
      }
      const normalized = [];
      const seen = new Set();
      for (const item of rawValue) {
        if (typeof item !== "string") {
          return STRUCTURED_INVALID_VALUE;
        }
        const token = item.trim();
        if (token.length === 0 || seen.has(token)) {
          continue;
        }
        seen.add(token);
        normalized.push(token);
      }
      return normalized;
    }
    case "group":
      return normalizeStructuredObjectInputValue(rawValue, {
        objectSchema: {
          properties: Array.isArray(property.properties) ? property.properties : []
        }
      });
    default:
      return rawValue;
  }
}

function normalizeStructuredObjectInputValue(rawValue, { objectSchema } = {}) {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  if (!isPlainObject(rawValue)) {
    return STRUCTURED_INVALID_VALUE;
  }

  const properties = Array.isArray(objectSchema?.properties) ? objectSchema.properties : [];
  const next = {};
  for (const property of properties) {
    next[property.id] = normalizeStructuredPropertyInputValue(rawValue[property.id], property);
  }
  return next;
}

function normalizeStructuredObjectStoredValue(
  rawValue,
  {
    objectSchema,
    explicitDefault = null
  } = {}
) {
  const normalized = normalizeStructuredObjectInputValue(rawValue, {
    objectSchema
  });
  if (normalized === STRUCTURED_INVALID_VALUE) {
    return cloneStructuredValue(explicitDefault ?? null);
  }
  return cloneStructuredValue(normalized);
}

function normalizeStructuredObjectArrayInputValue(rawValue, { itemSchema } = {}) {
  if (rawValue === undefined) {
    return undefined;
  }
  if (rawValue === null) {
    return [];
  }

  if (!Array.isArray(rawValue)) {
    return STRUCTURED_INVALID_VALUE;
  }

  const normalized = [];
  for (const item of rawValue) {
    const nextItem = normalizeStructuredObjectInputValue(item, {
      objectSchema: itemSchema
    });
    if (nextItem === STRUCTURED_INVALID_VALUE) {
      return STRUCTURED_INVALID_VALUE;
    }
    normalized.push(nextItem);
  }

  return normalized;
}

function normalizeStructuredObjectArrayStoredValue(
  rawValue,
  {
    itemSchema,
    explicitDefault = []
  } = {}
) {
  const normalized = normalizeStructuredObjectArrayInputValue(rawValue, {
    itemSchema
  });
  if (normalized === STRUCTURED_INVALID_VALUE || normalized === undefined) {
    return cloneStructuredValue(explicitDefault ?? []);
  }
  return cloneStructuredValue(normalized);
}


export {
  normalizeStructuredObjectArrayInputValue,
  normalizeStructuredObjectArrayStoredValue,
  normalizeStructuredObjectInputValue,
  normalizeStructuredObjectStoredValue
};
