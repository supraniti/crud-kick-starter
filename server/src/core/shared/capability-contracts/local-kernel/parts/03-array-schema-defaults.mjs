import {
  DEFAULT_OBJECT_ARRAY_ITEM_LABEL,
  isPlainObject,
  normalizeNonNegativeInteger
} from "./01-primitives.mjs";
import {
  normalizeStructuredObjectSchema
} from "./02-schema-core.mjs";

function defaultStructuredObjectArrayConstraintsValue() {
  return {
    itemSchema: {
      properties: []
    },
    minItems: null,
    maxItems: null,
    itemLabel: DEFAULT_OBJECT_ARRAY_ITEM_LABEL
  };
}

function resolveStructuredObjectArrayItemLabel(rawConstraints) {
  if (typeof rawConstraints.itemLabel === "string" && rawConstraints.itemLabel.trim().length > 0) {
    return rawConstraints.itemLabel.trim();
  }

  return DEFAULT_OBJECT_ARRAY_ITEM_LABEL;
}

function resolveStructuredObjectArrayBounds(rawConstraints) {
  return {
    minItems:
      rawConstraints.minItems === undefined
        ? null
        : normalizeNonNegativeInteger(rawConstraints.minItems),
    maxItems:
      rawConstraints.maxItems === undefined
        ? null
        : normalizeNonNegativeInteger(rawConstraints.maxItems)
  };
}

function validateStrictStructuredObjectArrayBounds({
  strict,
  path,
  rawConstraints,
  minItems,
  maxItems
}) {
  if (!strict) {
    return null;
  }

  if (rawConstraints.minItems !== undefined && minItems === null) {
    return {
      ok: false,
      reason: `${path}.minItems must be an integer >= 0`
    };
  }

  if (rawConstraints.maxItems !== undefined && maxItems === null) {
    return {
      ok: false,
      reason: `${path}.maxItems must be an integer >= 0`
    };
  }

  if (Number.isInteger(minItems) && Number.isInteger(maxItems) && maxItems < minItems) {
    return {
      ok: false,
      reason: `${path}.maxItems must be greater than or equal to minItems`
    };
  }

  return null;
}

function resolveStructuredObjectArrayItemSchemaCandidate(rawConstraints) {
  if (rawConstraints.itemSchema !== undefined) {
    return rawConstraints.itemSchema;
  }

  if (rawConstraints.schema !== undefined) {
    return rawConstraints.schema;
  }

  if (Array.isArray(rawConstraints.properties)) {
    return {
      properties: rawConstraints.properties
    };
  }

  return null;
}

function normalizeStructuredObjectArrayConstraints(rawConstraints, options = {}) {
  const strict = options.strict === true;
  const path = typeof options.path === "string" ? options.path : "constraints";
  if (!isPlainObject(rawConstraints)) {
    if (strict) {
      return {
        ok: false,
        reason: `${path} must be an object`
      };
    }

    return {
      ok: true,
      value: defaultStructuredObjectArrayConstraintsValue()
    };
  }

  const normalizedItemLabel = resolveStructuredObjectArrayItemLabel(rawConstraints);
  const { minItems, maxItems } = resolveStructuredObjectArrayBounds(rawConstraints);
  const boundsValidationError = validateStrictStructuredObjectArrayBounds({
    strict,
    path,
    rawConstraints,
    minItems,
    maxItems
  });
  if (boundsValidationError) {
    return boundsValidationError;
  }

  const itemSchemaCandidate = resolveStructuredObjectArrayItemSchemaCandidate(rawConstraints);
  const itemSchema = normalizeStructuredObjectSchema(itemSchemaCandidate, {
    strict,
    path: `${path}.itemSchema`
  });
  if (!itemSchema.ok) {
    return itemSchema;
  }

  return {
    ok: true,
    value: {
      itemSchema: itemSchema.value,
      minItems: Number.isInteger(minItems) ? minItems : null,
      maxItems: Number.isInteger(maxItems) ? maxItems : null,
      itemLabel: normalizedItemLabel
    }
  };
}

function defaultStructuredPropertyValue(property = {}) {
  switch (property.type) {
    case "text":
      return "";
    case "number":
      return null;
    case "boolean":
      return false;
    case "enum":
      return property.options?.[0] ?? null;
    case "string-list":
      return [];
    case "group":
      return defaultStructuredObjectValue({
        properties: Array.isArray(property.properties) ? property.properties : []
      });
    default:
      return null;
  }
}

function defaultStructuredObjectValue(schema = null) {
  const properties = Array.isArray(schema?.properties) ? schema.properties : [];
  const next = {};
  for (const property of properties) {
    next[property.id] = defaultStructuredPropertyValue(property);
  }
  return next;
}


function resolveStructuredObjectArrayConstraintsFromDescriptor(fieldDescriptor, options = {}) {
  const strict = options.strict === true;
  const path = typeof options.path === "string" ? options.path : "constraints";
  const rawConstraints = fieldDescriptor?.objectArrayConstraints ?? fieldDescriptor?.constraints;
  return normalizeStructuredObjectArrayConstraints(rawConstraints, {
    strict,
    path
  });
}


export {
  defaultStructuredObjectValue,
  normalizeStructuredObjectArrayConstraints,
  resolveStructuredObjectArrayConstraintsFromDescriptor
};
