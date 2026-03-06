import {
  DEFAULT_OBJECT_ARRAY_ITEM_LABEL,
  STRUCTURED_INVALID_VALUE,
  isPlainObject
} from "./01-primitives.mjs";
import {
  resolveStructuredObjectSchemaFromDescriptor
} from "./02-schema-core.mjs";
import {
  resolveStructuredObjectArrayConstraintsFromDescriptor
} from "./03-array-schema-defaults.mjs";

function createStructuredValidationMessagePrefix(definition, fieldDescriptor, nestedPath = "") {
  const entityTitle =
    typeof definition?.entityTitle === "string" && definition.entityTitle.length > 0
      ? definition.entityTitle
      : "Item";
  const fieldLabel =
    typeof fieldDescriptor?.id === "string" && fieldDescriptor.id.length > 0
      ? fieldDescriptor.id
      : "field";
  if (nestedPath.length === 0) {
    return `${entityTitle} ${fieldLabel}`;
  }
  return `${entityTitle} ${fieldLabel}.${nestedPath}`;
}

function isMissingStructuredValue(value, property) {
  if (value === null || value === undefined) {
    return true;
  }

  if (property.type === "text" || property.type === "enum") {
    return typeof value !== "string" || value.trim().length === 0;
  }

  if (property.type === "string-list") {
    return !Array.isArray(value) || value.length === 0;
  }

  return false;
}

function pushStructuredValidationError(errors, codeSuffix, message) {
  errors.push({
    codeSuffix,
    message
  });
}

function collectTextPropertyValidationErrors(value, property, messagePrefix, errors) {
  if (typeof value !== "string") {
    pushStructuredValidationError(errors, "NESTED_INVALID", `${messagePrefix} must be a string`);
    return;
  }
  if (Number.isInteger(property.minLength) && value.length < property.minLength) {
    pushStructuredValidationError(
      errors,
      "NESTED_TOO_SHORT",
      `${messagePrefix} must be at least ${property.minLength} characters`
    );
  }
  if (Number.isInteger(property.maxLength) && value.length > property.maxLength) {
    pushStructuredValidationError(
      errors,
      "NESTED_TOO_LONG",
      `${messagePrefix} must be at most ${property.maxLength} characters`
    );
  }
}

function collectNumberPropertyValidationErrors(value, property, messagePrefix, errors) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    pushStructuredValidationError(
      errors,
      "NESTED_INVALID",
      `${messagePrefix} must be a finite number`
    );
    return;
  }
  if (Number.isFinite(property.min) && value < property.min) {
    pushStructuredValidationError(
      errors,
      "NESTED_TOO_SMALL",
      `${messagePrefix} must be greater than or equal to ${property.min}`
    );
  }
  if (Number.isFinite(property.max) && value > property.max) {
    pushStructuredValidationError(
      errors,
      "NESTED_TOO_LARGE",
      `${messagePrefix} must be less than or equal to ${property.max}`
    );
  }
}

function collectBooleanPropertyValidationErrors(value, _, messagePrefix, errors) {
  if (typeof value !== "boolean") {
    pushStructuredValidationError(errors, "NESTED_INVALID", `${messagePrefix} must be a boolean`);
  }
}

function collectEnumPropertyValidationErrors(value, property, messagePrefix, errors) {
  const optionSet =
    property.optionSet instanceof Set
      ? property.optionSet
      : new Set(Array.isArray(property.options) ? property.options : []);
  if (typeof value !== "string" || !optionSet.has(value)) {
    pushStructuredValidationError(
      errors,
      "NESTED_INVALID",
      `${messagePrefix} must be one of: ${(property.options ?? []).join(", ")}`
    );
  }
}

function collectStringListPropertyValidationErrors(value, property, messagePrefix, errors) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    pushStructuredValidationError(
      errors,
      "NESTED_INVALID",
      `${messagePrefix} must be an array of strings`
    );
    return;
  }
  if (Number.isInteger(property.minItems) && value.length < property.minItems) {
    pushStructuredValidationError(
      errors,
      "NESTED_TOO_SHORT",
      `${messagePrefix} must include at least ${property.minItems} item(s)`
    );
  }
  if (Number.isInteger(property.maxItems) && value.length > property.maxItems) {
    pushStructuredValidationError(
      errors,
      "NESTED_TOO_LONG",
      `${messagePrefix} must include at most ${property.maxItems} item(s)`
    );
  }
}

function collectGroupPropertyValidationErrors({
  value,
  property,
  nestedPath,
  messagePrefix,
  errors,
  definition,
  fieldDescriptor
}) {
  if (!isPlainObject(value)) {
    pushStructuredValidationError(errors, "NESTED_INVALID", `${messagePrefix} must be an object`);
    return;
  }
  for (const nestedProperty of property.properties ?? []) {
    collectStructuredPropertyValidationErrors({
      value: value[nestedProperty.id],
      property: nestedProperty,
      pathPrefix: nestedPath,
      errors,
      definition,
      fieldDescriptor
    });
  }
}

const STRUCTURED_PROPERTY_VALIDATORS = Object.freeze({
  text: ({ value, property, messagePrefix, errors }) =>
    collectTextPropertyValidationErrors(value, property, messagePrefix, errors),
  number: ({ value, property, messagePrefix, errors }) =>
    collectNumberPropertyValidationErrors(value, property, messagePrefix, errors),
  boolean: ({ value, property, messagePrefix, errors }) =>
    collectBooleanPropertyValidationErrors(value, property, messagePrefix, errors),
  enum: ({ value, property, messagePrefix, errors }) =>
    collectEnumPropertyValidationErrors(value, property, messagePrefix, errors),
  "string-list": ({ value, property, messagePrefix, errors }) =>
    collectStringListPropertyValidationErrors(value, property, messagePrefix, errors),
  group: ({
    value,
    property,
    nestedPath,
    messagePrefix,
    errors,
    definition,
    fieldDescriptor
  }) =>
    collectGroupPropertyValidationErrors({
      value,
      property,
      nestedPath,
      messagePrefix,
      errors,
      definition,
      fieldDescriptor
    })
});

function collectStructuredPropertyValidationErrors({
  value,
  property,
  pathPrefix,
  errors,
  definition,
  fieldDescriptor
}) {
  const nestedPath = pathPrefix.length > 0 ? `${pathPrefix}.${property.id}` : property.id;
  const messagePrefix = createStructuredValidationMessagePrefix(
    definition,
    fieldDescriptor,
    nestedPath
  );

  if (value === STRUCTURED_INVALID_VALUE) {
    pushStructuredValidationError(errors, "NESTED_INVALID", `${messagePrefix} is invalid`);
    return;
  }

  if (property.required === true && isMissingStructuredValue(value, property)) {
    pushStructuredValidationError(errors, "NESTED_REQUIRED", `${messagePrefix} is required`);
    return;
  }

  if (value === null || value === undefined) {
    return;
  }
  const validateStructuredProperty = STRUCTURED_PROPERTY_VALIDATORS[property.type];
  if (typeof validateStructuredProperty !== "function") {
    return;
  }
  validateStructuredProperty({
    value,
    property,
    nestedPath,
    messagePrefix,
    errors,
    definition,
    fieldDescriptor
  });
}

function validateStructuredObjectInputValue({
  value,
  definition,
  fieldDescriptor
} = {}) {
  const errors = [];
  if (value === STRUCTURED_INVALID_VALUE) {
    errors.push({
      codeSuffix: "NESTED_INVALID",
      message: `${createStructuredValidationMessagePrefix(definition, fieldDescriptor)} must be an object`
    });
    return errors;
  }

  if (value === null || value === undefined) {
    if (fieldDescriptor?.required === true) {
      errors.push({
        codeSuffix: "REQUIRED",
        message: `${createStructuredValidationMessagePrefix(definition, fieldDescriptor)} is required`
      });
    }
    return errors;
  }

  if (!isPlainObject(value)) {
    errors.push({
      codeSuffix: "NESTED_INVALID",
      message: `${createStructuredValidationMessagePrefix(definition, fieldDescriptor)} must be an object`
    });
    return errors;
  }

  const objectSchema = resolveStructuredObjectSchemaFromDescriptor(fieldDescriptor, {
    strict: false
  });
  const properties = objectSchema.ok === true ? objectSchema.value.properties : [];
  for (const property of properties) {
    collectStructuredPropertyValidationErrors({
      value: value[property.id],
      property,
      pathPrefix: "",
      errors,
      definition,
      fieldDescriptor
    });
  }
  return errors;
}

function validateStructuredObjectArrayInputValue({
  value,
  definition,
  fieldDescriptor
} = {}) {
  const errors = [];
  const constraints = resolveStructuredObjectArrayConstraintsFromDescriptor(fieldDescriptor, {
    strict: false
  });

  if (value === STRUCTURED_INVALID_VALUE) {
    errors.push({
      codeSuffix: "NESTED_INVALID",
      message: `${createStructuredValidationMessagePrefix(definition, fieldDescriptor)} must be an array`
    });
    return errors;
  }

  if (value === null || value === undefined) {
    if (fieldDescriptor?.required === true) {
      errors.push({
        codeSuffix: "REQUIRED",
        message: `${createStructuredValidationMessagePrefix(definition, fieldDescriptor)} is required`
      });
    }
    return errors;
  }

  if (!Array.isArray(value)) {
    errors.push({
      codeSuffix: "NESTED_INVALID",
      message: `${createStructuredValidationMessagePrefix(definition, fieldDescriptor)} must be an array`
    });
    return errors;
  }

  const minItems = constraints.ok ? constraints.value.minItems : null;
  const maxItems = constraints.ok ? constraints.value.maxItems : null;
  if (Number.isInteger(minItems) && value.length < minItems) {
    errors.push({
      codeSuffix: "NESTED_TOO_SHORT",
      message: `${createStructuredValidationMessagePrefix(definition, fieldDescriptor)} must include at least ${minItems} item(s)`
    });
  }
  if (Number.isInteger(maxItems) && value.length > maxItems) {
    errors.push({
      codeSuffix: "NESTED_TOO_LONG",
      message: `${createStructuredValidationMessagePrefix(definition, fieldDescriptor)} must include at most ${maxItems} item(s)`
    });
  }

  const itemProperties = constraints.ok ? constraints.value.itemSchema.properties : [];
  for (const [index, item] of value.entries()) {
    if (!isPlainObject(item)) {
      errors.push({
        codeSuffix: "NESTED_INVALID",
        message: `${createStructuredValidationMessagePrefix(definition, fieldDescriptor, `${index}`)} must be an object`
      });
      continue;
    }

    for (const property of itemProperties) {
      collectStructuredPropertyValidationErrors({
        value: item[property.id],
        property,
        pathPrefix: `${index}`,
        errors,
        definition,
        fieldDescriptor
      });
    }
  }

  return errors;
}


function summarizeStructuredObjectValue(value, schema = null) {
  if (!isPlainObject(value)) {
    return "-";
  }

  const properties = Array.isArray(schema?.properties) ? schema.properties : [];
  const preview = [];
  for (const property of properties) {
    if (preview.length >= 2) {
      break;
    }
    const propertyValue = value[property.id];
    if (propertyValue === null || propertyValue === undefined) {
      continue;
    }

    if (typeof propertyValue === "string" && propertyValue.trim().length > 0) {
      preview.push(`${property.label}: ${propertyValue}`);
      continue;
    }
    if (typeof propertyValue === "number" || typeof propertyValue === "boolean") {
      preview.push(`${property.label}: ${propertyValue}`);
      continue;
    }
    if (Array.isArray(propertyValue) && propertyValue.length > 0) {
      preview.push(`${property.label}: ${propertyValue.length}`);
      continue;
    }
  }

  if (preview.length > 0) {
    return preview.join(", ");
  }
  return "Object";
}

function summarizeStructuredObjectArrayValue(
  value,
  {
    itemLabel = DEFAULT_OBJECT_ARRAY_ITEM_LABEL
  } = {}
) {
  if (!Array.isArray(value)) {
    return "-";
  }

  const count = value.length;
  if (count === 0) {
    return `0 ${itemLabel}s`;
  }
  if (count === 1) {
    return `1 ${itemLabel}`;
  }
  return `${count} ${itemLabel}s`;
}


export {
  summarizeStructuredObjectArrayValue,
  summarizeStructuredObjectValue,
  validateStructuredObjectArrayInputValue,
  validateStructuredObjectInputValue
};
