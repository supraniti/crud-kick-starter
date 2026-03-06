export {
  DEFAULT_OBJECT_ARRAY_ITEM_LABEL,
  STRUCTURED_INVALID_VALUE,
  STRUCTURED_PROPERTY_TYPES,
  cloneStructuredValue,
  isPlainObject
} from "./parts/01-primitives.mjs";

export {
  normalizeStructuredObjectSchema,
  resolveStructuredObjectSchemaFromDescriptor
} from "./parts/02-schema-core.mjs";

export {
  defaultStructuredObjectValue,
  normalizeStructuredObjectArrayConstraints,
  resolveStructuredObjectArrayConstraintsFromDescriptor
} from "./parts/03-array-schema-defaults.mjs";

export {
  normalizeStructuredObjectArrayInputValue,
  normalizeStructuredObjectArrayStoredValue,
  normalizeStructuredObjectInputValue,
  normalizeStructuredObjectStoredValue
} from "./parts/04-input-normalization.mjs";

export {
  summarizeStructuredObjectArrayValue,
  summarizeStructuredObjectValue,
  validateStructuredObjectArrayInputValue,
  validateStructuredObjectInputValue
} from "./parts/05-validation-summary.mjs";


