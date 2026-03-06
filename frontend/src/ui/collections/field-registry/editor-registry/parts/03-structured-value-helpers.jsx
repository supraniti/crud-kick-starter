import {
  defaultStructuredObjectValue,
  resolveStructuredObjectArrayConstraintsFromDescriptor,
  resolveStructuredObjectSchemaFromDescriptor
} from "../../../../../runtime/shared-capability-bridges/structured-field-runtime.mjs";

function cloneJsonValue(value) {
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

function resolveStructuredObjectSchema(field) {
  const normalized = resolveStructuredObjectSchemaFromDescriptor(field, {
    strict: false
  });
  return normalized.ok
    ? normalized.value
    : {
        properties: []
      };
}

function resolveStructuredObjectArrayConstraints(field) {
  const normalized = resolveStructuredObjectArrayConstraintsFromDescriptor(field, {
    strict: false
  });
  return normalized.ok
    ? normalized.value
    : {
        itemSchema: {
          properties: []
        },
        itemLabel: "item"
      };
}

function ensureStructuredObjectValue(field, rawValue) {
  const objectSchema = resolveStructuredObjectSchema(field);
  const baseValue = defaultStructuredObjectValue(objectSchema);
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return baseValue;
  }

  const next = cloneJsonValue(baseValue);
  for (const property of objectSchema.properties ?? []) {
    if (!Object.prototype.hasOwnProperty.call(rawValue, property.id)) {
      continue;
    }
    next[property.id] = cloneJsonValue(rawValue[property.id]);
  }

  return next;
}

function ensureStructuredObjectArrayValue(field, rawValue) {
  const constraints = resolveStructuredObjectArrayConstraints(field);
  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue
    .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
    .map((entry) =>
      ensureStructuredObjectValue(
        {
          constraints: {
            objectSchema: constraints.itemSchema
          }
        },
        entry
      )
    );
}

function normalizeStringListInputValue(rawValue) {
  if (typeof rawValue !== "string") {
    return [];
  }

  return [
    ...new Set(
      rawValue
        .split(",")
        .map((token) => token.trim())
        .filter((token) => token.length > 0)
    )
  ];
}

function updateStructuredObjectValueByPath(value, pathSegments, nextValue) {
  const normalizedPath = Array.isArray(pathSegments)
    ? pathSegments.filter((segment) => typeof segment === "string" && segment.length > 0)
    : [];
  if (normalizedPath.length === 0) {
    return cloneJsonValue(value);
  }

  const nextRoot =
    value && typeof value === "object" && !Array.isArray(value) ? cloneJsonValue(value) : {};
  let cursor = nextRoot;
  for (let index = 0; index < normalizedPath.length - 1; index += 1) {
    const segment = normalizedPath[index];
    const candidate = cursor[segment];
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      cursor[segment] = {};
    }
    cursor = cursor[segment];
  }

  cursor[normalizedPath[normalizedPath.length - 1]] = nextValue;
  return nextRoot;
}

export {
  cloneJsonValue,
  ensureStructuredObjectArrayValue,
  ensureStructuredObjectValue,
  normalizeStringListInputValue,
  resolveStructuredObjectArrayConstraints,
  resolveStructuredObjectSchema,
  updateStructuredObjectValueByPath
};
