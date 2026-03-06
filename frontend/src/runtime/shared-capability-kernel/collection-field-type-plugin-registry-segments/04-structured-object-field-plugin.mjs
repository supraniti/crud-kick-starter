import {
  DEFAULT_OBJECT_ARRAY_ITEM_LABEL,
  STRUCTURED_INVALID_VALUE,
  defaultStructuredObjectValue,
  normalizeStructuredObjectArrayInputValue,
  normalizeStructuredObjectArrayStoredValue,
  normalizeStructuredObjectInputValue,
  normalizeStructuredObjectStoredValue,
  resolveStructuredObjectArrayConstraintsFromDescriptor,
  resolveStructuredObjectSchemaFromDescriptor,
  summarizeStructuredObjectArrayValue,
  summarizeStructuredObjectValue,
  validateStructuredObjectArrayInputValue,
  validateStructuredObjectInputValue
} from "../structured-field-runtime.mjs";

function normalizeStructuredObjectCollectionFieldConstraints(
  rawField = {},
  { strict = false } = {}
) {
  const schemaResult = resolveStructuredObjectSchemaFromDescriptor(rawField, {
    strict,
    path: "constraints.objectSchema"
  });
  if (!schemaResult.ok) {
    return schemaResult;
  }

  return {
    ok: true,
    descriptorPatch: {
      constraints: {
        objectSchema: schemaResult.value
      }
    }
  };
}

function normalizeStructuredObjectArrayCollectionFieldConstraints(
  rawField = {},
  { strict = false } = {}
) {
  const constraintsResult = resolveStructuredObjectArrayConstraintsFromDescriptor(rawField, {
    strict,
    path: "constraints"
  });
  if (!constraintsResult.ok) {
    return constraintsResult;
  }

  return {
    ok: true,
    descriptorPatch: {
      constraints: constraintsResult.value
    }
  };
}

function normalizeStructuredObjectCollectionFieldDefaultValue(
  descriptor = {},
  rawValue
) {
  if (rawValue === null) {
    if (descriptor.required === true) {
      return {
        ok: false,
        reason: "defaultValue cannot be null when field is required"
      };
    }
    return {
      ok: true,
      value: null
    };
  }

  if (rawValue === undefined) {
    return {
      ok: true,
      value: descriptor.required === true
        ? defaultStructuredObjectValue(
            resolveStructuredObjectSchemaFromDescriptor(descriptor, {
              strict: false
            }).value
          )
        : null
    };
  }

  const objectSchemaResult = resolveStructuredObjectSchemaFromDescriptor(descriptor, {
    strict: true,
    path: "constraints.objectSchema"
  });
  if (!objectSchemaResult.ok) {
    return objectSchemaResult;
  }

  const normalized = normalizeStructuredObjectInputValue(rawValue, {
    objectSchema: objectSchemaResult.value
  });
  if (normalized === STRUCTURED_INVALID_VALUE) {
    return {
      ok: false,
      reason: "defaultValue must be an object or null"
    };
  }

  const validationErrors = validateStructuredObjectInputValue({
    value: normalized,
    definition: {
      entityTitle: "Field"
    },
    fieldDescriptor: {
      id: "defaultValue",
      required: descriptor.required === true,
      constraints: {
        objectSchema: objectSchemaResult.value
      }
    }
  });
  if (validationErrors.length > 0) {
    return {
      ok: false,
      reason: validationErrors[0].message
    };
  }

  return {
    ok: true,
    value: normalized
  };
}

function normalizeStructuredObjectArrayCollectionFieldDefaultValue(
  descriptor = {},
  rawValue
) {
  if (rawValue === null) {
    if (descriptor.required === true) {
      return {
        ok: false,
        reason: "defaultValue cannot be null when field is required"
      };
    }
    return {
      ok: true,
      value: []
    };
  }

  if (rawValue === undefined) {
    return {
      ok: true,
      value: []
    };
  }

  const constraintsResult = resolveStructuredObjectArrayConstraintsFromDescriptor(descriptor, {
    strict: true,
    path: "constraints"
  });
  if (!constraintsResult.ok) {
    return constraintsResult;
  }

  const normalized = normalizeStructuredObjectArrayInputValue(rawValue, {
    itemSchema: constraintsResult.value.itemSchema
  });
  if (normalized === STRUCTURED_INVALID_VALUE || normalized === undefined) {
    return {
      ok: false,
      reason: "defaultValue must be an array of objects or null"
    };
  }

  const validationErrors = validateStructuredObjectArrayInputValue({
    value: normalized,
    definition: {
      entityTitle: "Field"
    },
    fieldDescriptor: {
      id: "defaultValue",
      required: descriptor.required === true,
      constraints: constraintsResult.value
    }
  });
  if (validationErrors.length > 0) {
    return {
      ok: false,
      reason: validationErrors[0].message
    };
  }

  return {
    ok: true,
    value: normalized
  };
}

function normalizeStructuredObjectCollectionFieldInputValue(rawValue, { fieldDescriptor } = {}) {
  const objectSchemaResult = resolveStructuredObjectSchemaFromDescriptor(fieldDescriptor, {
    strict: false
  });
  return normalizeStructuredObjectInputValue(rawValue, {
    objectSchema: objectSchemaResult.ok ? objectSchemaResult.value : {
      properties: []
    }
  });
}

function normalizeStructuredObjectCollectionFieldStoredValue(
  rawValue,
  {
    explicitDefault = null,
    fieldDescriptor
  } = {}
) {
  const objectSchemaResult = resolveStructuredObjectSchemaFromDescriptor(fieldDescriptor, {
    strict: false
  });
  const objectSchema = objectSchemaResult.ok ? objectSchemaResult.value : {
    properties: []
  };

  return normalizeStructuredObjectStoredValue(rawValue, {
    objectSchema,
    explicitDefault
  });
}

function defaultStructuredObjectCollectionFieldValue({ fieldDescriptor } = {}) {
  const objectSchemaResult = resolveStructuredObjectSchemaFromDescriptor(fieldDescriptor, {
    strict: false
  });
  const objectSchema = objectSchemaResult.ok ? objectSchemaResult.value : {
    properties: []
  };

  if (fieldDescriptor?.required === true) {
    return defaultStructuredObjectValue(objectSchema);
  }

  return null;
}

function validateStructuredObjectCollectionFieldInputValue(
  {
    value,
    definition,
    fieldDescriptor
  } = {}
) {
  return validateStructuredObjectInputValue({
    value,
    definition,
    fieldDescriptor
  });
}

function summarizeStructuredObjectCollectionFieldCellValue(
  {
    value,
    fieldDescriptor
  } = {}
) {
  const objectSchemaResult = resolveStructuredObjectSchemaFromDescriptor(fieldDescriptor, {
    strict: false
  });
  return summarizeStructuredObjectValue(
    value,
    objectSchemaResult.ok ? objectSchemaResult.value : null
  );
}

function normalizeStructuredObjectArrayCollectionFieldInputValue(
  rawValue,
  { fieldDescriptor } = {}
) {
  const constraintsResult = resolveStructuredObjectArrayConstraintsFromDescriptor(
    fieldDescriptor,
    {
      strict: false
    }
  );
  return normalizeStructuredObjectArrayInputValue(rawValue, {
    itemSchema: constraintsResult.ok
      ? constraintsResult.value.itemSchema
      : {
          properties: []
        }
  });
}

function normalizeStructuredObjectArrayCollectionFieldStoredValue(
  rawValue,
  {
    explicitDefault = [],
    fieldDescriptor
  } = {}
) {
  const constraintsResult = resolveStructuredObjectArrayConstraintsFromDescriptor(
    fieldDescriptor,
    {
      strict: false
    }
  );
  const itemSchema = constraintsResult.ok
    ? constraintsResult.value.itemSchema
    : {
        properties: []
      };

  return normalizeStructuredObjectArrayStoredValue(rawValue, {
    itemSchema,
    explicitDefault
  });
}

function defaultStructuredObjectArrayCollectionFieldValue() {
  return [];
}

function validateStructuredObjectArrayCollectionFieldInputValue(
  {
    value,
    definition,
    fieldDescriptor
  } = {}
) {
  return validateStructuredObjectArrayInputValue({
    value,
    definition,
    fieldDescriptor
  });
}

function summarizeStructuredObjectArrayCollectionFieldCellValue(
  {
    value,
    fieldDescriptor
  } = {}
) {
  const constraintsResult = resolveStructuredObjectArrayConstraintsFromDescriptor(
    fieldDescriptor,
    {
      strict: false
    }
  );
  return summarizeStructuredObjectArrayValue(value, {
    itemLabel:
      constraintsResult.ok
        ? constraintsResult.value.itemLabel ?? DEFAULT_OBJECT_ARRAY_ITEM_LABEL
        : DEFAULT_OBJECT_ARRAY_ITEM_LABEL
  });
}

const STRUCTURED_OBJECT_COLLECTION_FIELD_TYPE_PLUGIN = Object.freeze({
  type: "structured-object",
  schema: Object.freeze({
    kind: "json"
  }),
  normalizeDescriptorConstraints: normalizeStructuredObjectCollectionFieldConstraints,
  normalizeDefaultValue: normalizeStructuredObjectCollectionFieldDefaultValue,
  runtime: Object.freeze({
    normalizeInputValue: normalizeStructuredObjectCollectionFieldInputValue,
    normalizeStoredValue: normalizeStructuredObjectCollectionFieldStoredValue,
    defaultValue: defaultStructuredObjectCollectionFieldValue,
    validateInputValue: validateStructuredObjectCollectionFieldInputValue
  }),
  frontend: Object.freeze({
    editor: Object.freeze({
      variant: "structured-object"
    }),
    cell: Object.freeze({
      variant: "structured-summary",
      summarizeValue: summarizeStructuredObjectCollectionFieldCellValue
    })
  }),
  query: Object.freeze({
    supported: false,
    codeSuffix: "FILTER_UNSUPPORTED",
    message: "Structured object fields do not support filtering"
  })
});

const STRUCTURED_OBJECT_ARRAY_COLLECTION_FIELD_TYPE_PLUGIN = Object.freeze({
  type: "structured-object-array",
  schema: Object.freeze({
    kind: "json"
  }),
  normalizeDescriptorConstraints: normalizeStructuredObjectArrayCollectionFieldConstraints,
  normalizeDefaultValue: normalizeStructuredObjectArrayCollectionFieldDefaultValue,
  runtime: Object.freeze({
    normalizeInputValue: normalizeStructuredObjectArrayCollectionFieldInputValue,
    normalizeStoredValue: normalizeStructuredObjectArrayCollectionFieldStoredValue,
    defaultValue: defaultStructuredObjectArrayCollectionFieldValue,
    validateInputValue: validateStructuredObjectArrayCollectionFieldInputValue
  }),
  frontend: Object.freeze({
    editor: Object.freeze({
      variant: "structured-object-array"
    }),
    cell: Object.freeze({
      variant: "structured-array-count",
      summarizeValue: summarizeStructuredObjectArrayCollectionFieldCellValue
    })
  }),
  query: Object.freeze({
    supported: false,
    codeSuffix: "FILTER_UNSUPPORTED",
    message: "Structured object array fields do not support filtering"
  })
});

export {
  STRUCTURED_OBJECT_ARRAY_COLLECTION_FIELD_TYPE_PLUGIN,
  STRUCTURED_OBJECT_COLLECTION_FIELD_TYPE_PLUGIN,
  defaultStructuredObjectArrayCollectionFieldValue,
  defaultStructuredObjectCollectionFieldValue,
  normalizeStructuredObjectArrayCollectionFieldConstraints,
  normalizeStructuredObjectArrayCollectionFieldDefaultValue,
  normalizeStructuredObjectArrayCollectionFieldInputValue,
  normalizeStructuredObjectArrayCollectionFieldStoredValue,
  normalizeStructuredObjectCollectionFieldConstraints,
  normalizeStructuredObjectCollectionFieldDefaultValue,
  normalizeStructuredObjectCollectionFieldInputValue,
  normalizeStructuredObjectCollectionFieldStoredValue,
  validateStructuredObjectArrayCollectionFieldInputValue,
  validateStructuredObjectCollectionFieldInputValue
};
