import {
  STRUCTURED_PROPERTY_ALLOWED_KEYS,
  STRUCTURED_PROPERTY_ID_PATTERN,
  STRUCTURED_PROPERTY_TYPES,
  isPlainObject,
  normalizeEnumOptions,
  normalizeFiniteNumber,
  normalizeNonNegativeInteger,
  normalizeStructuredPropertyType
} from "./01-primitives.mjs";

function normalizeStructuredObjectSchema(rawSchema, options = {}) {
  const strict = options.strict === true;
  const path = typeof options.path === "string" ? options.path : "schema";
  if (!isPlainObject(rawSchema)) {
    if (strict) {
      return {
        ok: false,
        reason: `${path} must be an object`
      };
    }

    return {
      ok: true,
      value: {
        properties: []
      }
    };
  }

  const rawProperties = rawSchema.properties;
  if (!Array.isArray(rawProperties)) {
    if (strict) {
      return {
        ok: false,
        reason: `${path}.properties must be an array`
      };
    }

    return {
      ok: true,
      value: {
        properties: []
      }
    };
  }

  const properties = [];
  const seenPropertyIds = new Set();
  for (const [index, rawProperty] of rawProperties.entries()) {
    const propertyPath = `${path}.properties.${index}`;
    const normalizedProperty = normalizeStructuredPropertySchema(rawProperty, {
      strict,
      path: propertyPath
    });
    if (!normalizedProperty.ok) {
      return normalizedProperty;
    }

    const propertyId = normalizedProperty.value.id;
    if (seenPropertyIds.has(propertyId)) {
      if (strict) {
        return {
          ok: false,
          reason: `${propertyPath}.id '${propertyId}' is duplicated`
        };
      }
      continue;
    }
    seenPropertyIds.add(propertyId);
    properties.push(normalizedProperty.value);
  }

  if (strict && properties.length === 0) {
    return {
      ok: false,
      reason: `${path}.properties must include at least one field`
    };
  }

  return {
    ok: true,
    value: {
      properties
    }
  };
}

function normalizeStructuredPropertyBase(rawProperty, path) {
  if (!isPlainObject(rawProperty)) {
    return {
      ok: false,
      reason: `${path} must be an object`
    };
  }

  const unknownPropertyKey = Object.keys(rawProperty).find(
    (key) => !STRUCTURED_PROPERTY_ALLOWED_KEYS.has(key)
  );
  if (unknownPropertyKey) {
    return {
      ok: false,
      reason: `${path}.${unknownPropertyKey} is not supported`
    };
  }

  const propertyId = typeof rawProperty.id === "string" ? rawProperty.id.trim() : "";
  if (!STRUCTURED_PROPERTY_ID_PATTERN.test(propertyId)) {
    return {
      ok: false,
      reason: `${path}.id must match ${STRUCTURED_PROPERTY_ID_PATTERN}`
    };
  }

  const propertyType = normalizeStructuredPropertyType(rawProperty.type);
  if (!propertyType) {
    return {
      ok: false,
      reason: `${path}.type must be one of: ${STRUCTURED_PROPERTY_TYPES.join(", ")}`
    };
  }

  return {
    ok: true,
    propertyType,
    normalized: {
      id: propertyId,
      label:
        typeof rawProperty.label === "string" && rawProperty.label.trim().length > 0
          ? rawProperty.label.trim()
          : propertyId,
      type: propertyType,
      required: rawProperty.required === true
    }
  };
}

function normalizeStructuredTextProperty(rawProperty, normalized, strict, path) {
  const minLength =
    rawProperty.minLength === undefined
      ? null
      : normalizeNonNegativeInteger(rawProperty.minLength);
  const maxLength =
    rawProperty.maxLength === undefined
      ? null
      : normalizeNonNegativeInteger(rawProperty.maxLength);

  if (strict && rawProperty.minLength !== undefined && minLength === null) {
    return {
      ok: false,
      reason: `${path}.minLength must be an integer >= 0`
    };
  }
  if (strict && rawProperty.maxLength !== undefined && maxLength === null) {
    return {
      ok: false,
      reason: `${path}.maxLength must be an integer >= 0`
    };
  }
  if (Number.isInteger(minLength) && Number.isInteger(maxLength) && maxLength < minLength) {
    if (strict) {
      return {
        ok: false,
        reason: `${path}.maxLength must be greater than or equal to minLength`
      };
    }
    normalized.minLength = maxLength;
    normalized.maxLength = minLength;
    return {
      ok: true,
      value: normalized
    };
  }
  if (Number.isInteger(minLength)) {
    normalized.minLength = minLength;
  }
  if (Number.isInteger(maxLength)) {
    normalized.maxLength = maxLength;
  }
  return {
    ok: true,
    value: normalized
  };
}

function normalizeStructuredNumberProperty(rawProperty, normalized, strict, path) {
  const min = rawProperty.min === undefined ? null : normalizeFiniteNumber(rawProperty.min);
  const max = rawProperty.max === undefined ? null : normalizeFiniteNumber(rawProperty.max);
  if (strict && rawProperty.min !== undefined && min === null) {
    return {
      ok: false,
      reason: `${path}.min must be a finite number`
    };
  }
  if (strict && rawProperty.max !== undefined && max === null) {
    return {
      ok: false,
      reason: `${path}.max must be a finite number`
    };
  }
  if (Number.isFinite(min)) {
    normalized.min = min;
  }
  if (Number.isFinite(max)) {
    normalized.max = max;
  }
  if (
    Number.isFinite(normalized.min) &&
    Number.isFinite(normalized.max) &&
    normalized.max < normalized.min
  ) {
    if (strict) {
      return {
        ok: false,
        reason: `${path}.max must be greater than or equal to min`
      };
    }
    const swap = normalized.min;
    normalized.min = normalized.max;
    normalized.max = swap;
  }
  return {
    ok: true,
    value: normalized
  };
}

function normalizeStructuredEnumProperty(rawProperty, normalized, strict, path) {
  const optionsResult = normalizeEnumOptions(rawProperty.options, {
    strict,
    path: `${path}.options`
  });
  if (!optionsResult.ok) {
    return optionsResult;
  }
  normalized.options = optionsResult.value;
  return {
    ok: true,
    value: normalized
  };
}

function normalizeStructuredStringListProperty(rawProperty, normalized, strict, path) {
  const minItems =
    rawProperty.minItems === undefined ? null : normalizeNonNegativeInteger(rawProperty.minItems);
  const maxItems =
    rawProperty.maxItems === undefined ? null : normalizeNonNegativeInteger(rawProperty.maxItems);

  if (strict && rawProperty.minItems !== undefined && minItems === null) {
    return {
      ok: false,
      reason: `${path}.minItems must be an integer >= 0`
    };
  }
  if (strict && rawProperty.maxItems !== undefined && maxItems === null) {
    return {
      ok: false,
      reason: `${path}.maxItems must be an integer >= 0`
    };
  }
  if (Number.isInteger(minItems) && Number.isInteger(maxItems) && maxItems < minItems) {
    if (strict) {
      return {
        ok: false,
        reason: `${path}.maxItems must be greater than or equal to minItems`
      };
    }
    normalized.minItems = maxItems;
    normalized.maxItems = minItems;
    return {
      ok: true,
      value: normalized
    };
  }
  if (Number.isInteger(minItems)) {
    normalized.minItems = minItems;
  }
  if (Number.isInteger(maxItems)) {
    normalized.maxItems = maxItems;
  }
  return {
    ok: true,
    value: normalized
  };
}

function normalizeStructuredGroupProperty(rawProperty, normalized, strict, path) {
  const nestedSchema = normalizeStructuredObjectSchema(
    {
      properties: rawProperty.properties
    },
    {
      strict,
      path: `${path}`
    }
  );
  if (!nestedSchema.ok) {
    return nestedSchema;
  }
  normalized.properties = nestedSchema.value.properties;
  return {
    ok: true,
    value: normalized
  };
}

const STRUCTURED_PROPERTY_CONSTRAINT_NORMALIZERS = Object.freeze({
  text: normalizeStructuredTextProperty,
  number: normalizeStructuredNumberProperty,
  enum: normalizeStructuredEnumProperty,
  "string-list": normalizeStructuredStringListProperty,
  group: normalizeStructuredGroupProperty
});

function normalizeStructuredPropertySchema(rawProperty, options = {}) {
  const strict = options.strict === true;
  const path = typeof options.path === "string" ? options.path : "property";
  const base = normalizeStructuredPropertyBase(rawProperty, path);
  if (!base.ok) {
    return base;
  }

  const normalizeConstraints = STRUCTURED_PROPERTY_CONSTRAINT_NORMALIZERS[base.propertyType];
  if (typeof normalizeConstraints === "function") {
    return normalizeConstraints(rawProperty, base.normalized, strict, path);
  }
  return {
    ok: true,
    value: base.normalized
  };
}


function resolveStructuredObjectSchemaFromDescriptor(fieldDescriptor, options = {}) {
  const strict = options.strict === true;
  const path = typeof options.path === "string" ? options.path : "constraints";
  const rawSchema =
    fieldDescriptor?.objectSchema ??
    fieldDescriptor?.constraints?.objectSchema ??
    fieldDescriptor?.constraints?.schema ??
    (Array.isArray(fieldDescriptor?.constraints?.properties)
      ? {
          properties: fieldDescriptor.constraints.properties
        }
      : null);

  return normalizeStructuredObjectSchema(rawSchema, {
    strict,
    path
  });
}


export {
  normalizeStructuredObjectSchema,
  resolveStructuredObjectSchemaFromDescriptor
};
