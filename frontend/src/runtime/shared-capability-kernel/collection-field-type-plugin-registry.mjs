import {
  COLLECTION_FIELD_TYPE_PLUGIN_SCHEMA_KINDS,
  COLLECTION_FIELD_TYPE_PLUGIN_SCHEMA_KINDS_LABEL,
  hasCollectionFieldTypePlugin,
  isCollectionFieldTypePluginSchemaKind,
  isCollectionFieldTypeQueryable,
  listCollectionFieldTypePlugins,
  listCollectionFieldTypePluginTypes,
  normalizeCollectionFieldTypePluginSchemaKind,
  normalizeCollectionFieldTypeToken,
  registerCollectionFieldTypePlugin,
  resolveCollectionFieldTypePlugin,
  resolveCollectionFieldTypeQueryContract,
  unregisterCollectionFieldTypePlugin
} from "./collection-field-type-plugin-registry-segments/01-registry-core.mjs";
import {
  URL_COLLECTION_FIELD_TYPE_PLUGIN,
  defaultUrlCollectionFieldValue,
  normalizeUrlCollectionFieldConstraints,
  normalizeUrlCollectionFieldDefaultValue,
  normalizeUrlCollectionFieldInputValue,
  normalizeUrlCollectionFieldStoredValue,
  validateUrlCollectionFieldInputValue
} from "./collection-field-type-plugin-registry-segments/02-url-field-plugin.mjs";
import {
  DATE_COLLECTION_FIELD_TYPE_PLUGIN,
  defaultDateCollectionFieldValue,
  normalizeDateCollectionFieldDefaultValue,
  normalizeDateCollectionFieldInputValue,
  normalizeDateCollectionFieldStoredValue,
  validateDateCollectionFieldInputValue
} from "./collection-field-type-plugin-registry-segments/03-date-field-plugin.mjs";
import {
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
} from "./collection-field-type-plugin-registry-segments/04-structured-object-field-plugin.mjs";

registerCollectionFieldTypePlugin(URL_COLLECTION_FIELD_TYPE_PLUGIN, {
  overwrite: true
});
registerCollectionFieldTypePlugin(DATE_COLLECTION_FIELD_TYPE_PLUGIN, {
  overwrite: true
});
registerCollectionFieldTypePlugin(STRUCTURED_OBJECT_COLLECTION_FIELD_TYPE_PLUGIN, {
  overwrite: true
});
registerCollectionFieldTypePlugin(STRUCTURED_OBJECT_ARRAY_COLLECTION_FIELD_TYPE_PLUGIN, {
  overwrite: true
});

export {
  COLLECTION_FIELD_TYPE_PLUGIN_SCHEMA_KINDS,
  COLLECTION_FIELD_TYPE_PLUGIN_SCHEMA_KINDS_LABEL,
  DATE_COLLECTION_FIELD_TYPE_PLUGIN,
  STRUCTURED_OBJECT_ARRAY_COLLECTION_FIELD_TYPE_PLUGIN,
  STRUCTURED_OBJECT_COLLECTION_FIELD_TYPE_PLUGIN,
  URL_COLLECTION_FIELD_TYPE_PLUGIN,
  defaultDateCollectionFieldValue,
  defaultStructuredObjectArrayCollectionFieldValue,
  defaultStructuredObjectCollectionFieldValue,
  defaultUrlCollectionFieldValue,
  hasCollectionFieldTypePlugin,
  isCollectionFieldTypePluginSchemaKind,
  isCollectionFieldTypeQueryable,
  listCollectionFieldTypePlugins,
  listCollectionFieldTypePluginTypes,
  normalizeCollectionFieldTypeToken,
  normalizeCollectionFieldTypePluginSchemaKind,
  normalizeDateCollectionFieldDefaultValue,
  normalizeDateCollectionFieldInputValue,
  normalizeDateCollectionFieldStoredValue,
  normalizeStructuredObjectArrayCollectionFieldConstraints,
  normalizeStructuredObjectArrayCollectionFieldDefaultValue,
  normalizeStructuredObjectArrayCollectionFieldInputValue,
  normalizeStructuredObjectArrayCollectionFieldStoredValue,
  normalizeStructuredObjectCollectionFieldConstraints,
  normalizeStructuredObjectCollectionFieldDefaultValue,
  normalizeStructuredObjectCollectionFieldInputValue,
  normalizeStructuredObjectCollectionFieldStoredValue,
  normalizeUrlCollectionFieldConstraints,
  normalizeUrlCollectionFieldDefaultValue,
  normalizeUrlCollectionFieldInputValue,
  normalizeUrlCollectionFieldStoredValue,
  registerCollectionFieldTypePlugin,
  resolveCollectionFieldTypeQueryContract,
  unregisterCollectionFieldTypePlugin,
  validateDateCollectionFieldInputValue,
  validateStructuredObjectArrayCollectionFieldInputValue,
  validateStructuredObjectCollectionFieldInputValue,
  validateUrlCollectionFieldInputValue,
  resolveCollectionFieldTypePlugin
};
