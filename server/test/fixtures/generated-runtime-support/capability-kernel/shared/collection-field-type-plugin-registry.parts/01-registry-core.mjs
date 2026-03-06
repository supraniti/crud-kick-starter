function normalizeCollectionFieldTypeToken(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

const COLLECTION_FIELD_TYPE_PLUGIN_SCHEMA_KINDS = Object.freeze([
  "text",
  "number",
  "boolean",
  "json",
  "ref"
]);
const COLLECTION_FIELD_TYPE_PLUGIN_SCHEMA_KIND_SET = new Set(
  COLLECTION_FIELD_TYPE_PLUGIN_SCHEMA_KINDS
);
const COLLECTION_FIELD_TYPE_PLUGIN_SCHEMA_KINDS_LABEL =
  COLLECTION_FIELD_TYPE_PLUGIN_SCHEMA_KINDS.join(", ");

function normalizeCollectionFieldTypePluginSchemaKind(value) {
  if (typeof value !== "string") {
    return "";
  }

  const normalizedKind = value.trim().toLowerCase();
  if (!COLLECTION_FIELD_TYPE_PLUGIN_SCHEMA_KIND_SET.has(normalizedKind)) {
    return "";
  }

  return normalizedKind;
}

function isCollectionFieldTypePluginSchemaKind(value) {
  return normalizeCollectionFieldTypePluginSchemaKind(value).length > 0;
}

const COLLECTION_FIELD_TYPE_PLUGIN_REGISTRY_GLOBAL_KEY = Symbol.for(
  "crud-control.collection-field-type-plugin-registry.v1"
);

function resolveCollectionFieldTypePluginRegistry() {
  const existingRegistry = globalThis[COLLECTION_FIELD_TYPE_PLUGIN_REGISTRY_GLOBAL_KEY];
  if (existingRegistry instanceof Map) {
    return existingRegistry;
  }

  const registry = new Map();
  Object.defineProperty(globalThis, COLLECTION_FIELD_TYPE_PLUGIN_REGISTRY_GLOBAL_KEY, {
    value: registry,
    writable: false,
    enumerable: false,
    configurable: false
  });
  return registry;
}

const COLLECTION_FIELD_TYPE_PLUGIN_REGISTRY = resolveCollectionFieldTypePluginRegistry();

function registerCollectionFieldTypePlugin(
  plugin,
  {
    overwrite = false
  } = {}
) {
  if (!plugin || typeof plugin !== "object") {
    return {
      ok: false,
      reason: "plugin must be an object"
    };
  }

  const type = normalizeCollectionFieldTypeToken(plugin.type);
  if (type.length === 0) {
    return {
      ok: false,
      reason: "plugin type must be a non-empty token"
    };
  }

  if (
    !plugin.schema ||
    typeof plugin.schema !== "object" ||
    Array.isArray(plugin.schema)
  ) {
    return {
      ok: false,
      reason: `plugin schema.kind must be one of: ${COLLECTION_FIELD_TYPE_PLUGIN_SCHEMA_KINDS_LABEL}`
    };
  }

  const schemaKind = normalizeCollectionFieldTypePluginSchemaKind(
    plugin.schema.kind
  );
  if (schemaKind.length === 0) {
    return {
      ok: false,
      reason: `plugin schema.kind must be one of: ${COLLECTION_FIELD_TYPE_PLUGIN_SCHEMA_KINDS_LABEL}`
    };
  }

  if (!overwrite && COLLECTION_FIELD_TYPE_PLUGIN_REGISTRY.has(type)) {
    return {
      ok: false,
      reason: `plugin type '${type}' is already registered`
    };
  }

  const normalizedPlugin =
    plugin.type === type && plugin.schema.kind === schemaKind
      ? plugin
      : {
          ...plugin,
          type,
          schema: {
            ...plugin.schema,
            kind: schemaKind
          }
        };

  COLLECTION_FIELD_TYPE_PLUGIN_REGISTRY.set(type, Object.freeze(normalizedPlugin));
  return {
    ok: true,
    value: COLLECTION_FIELD_TYPE_PLUGIN_REGISTRY.get(type)
  };
}

function unregisterCollectionFieldTypePlugin(type) {
  const normalizedType = normalizeCollectionFieldTypeToken(type);
  if (normalizedType.length === 0) {
    return false;
  }

  return COLLECTION_FIELD_TYPE_PLUGIN_REGISTRY.delete(normalizedType);
}

function listCollectionFieldTypePluginTypes() {
  return [...COLLECTION_FIELD_TYPE_PLUGIN_REGISTRY.keys()];
}

function listCollectionFieldTypePlugins() {
  return [...COLLECTION_FIELD_TYPE_PLUGIN_REGISTRY.values()];
}

function resolveCollectionFieldTypePlugin(value) {
  const type = normalizeCollectionFieldTypeToken(value);
  if (type.length === 0) {
    return null;
  }

  return COLLECTION_FIELD_TYPE_PLUGIN_REGISTRY.get(type) ?? null;
}

function resolveCollectionFieldTypeQueryContract(value) {
  const plugin = resolveCollectionFieldTypePlugin(value);
  if (!plugin || typeof plugin !== "object") {
    return {
      supported: true
    };
  }

  const pluginQuery = plugin.query;
  if (
    !pluginQuery ||
    typeof pluginQuery !== "object" ||
    pluginQuery.supported !== false
  ) {
    return {
      supported: true
    };
  }

  const normalizedCodeSuffix =
    typeof pluginQuery.codeSuffix === "string" && pluginQuery.codeSuffix.length > 0
      ? pluginQuery.codeSuffix
      : "FILTER_UNSUPPORTED";
  const normalizedMessage =
    typeof pluginQuery.message === "string" && pluginQuery.message.length > 0
      ? pluginQuery.message
      : `Field type '${plugin.type}' does not support filtering`;

  return {
    supported: false,
    codeSuffix: normalizedCodeSuffix,
    message: normalizedMessage
  };
}

function isCollectionFieldTypeQueryable(value) {
  return resolveCollectionFieldTypeQueryContract(value).supported === true;
}

function hasCollectionFieldTypePlugin(value) {
  return resolveCollectionFieldTypePlugin(value) !== null;
}

export {
  COLLECTION_FIELD_TYPE_PLUGIN_SCHEMA_KINDS,
  COLLECTION_FIELD_TYPE_PLUGIN_SCHEMA_KINDS_LABEL,
  hasCollectionFieldTypePlugin,
  isCollectionFieldTypePluginSchemaKind,
  isCollectionFieldTypeQueryable,
  listCollectionFieldTypePlugins,
  listCollectionFieldTypePluginTypes,
  normalizeCollectionFieldTypeToken,
  normalizeCollectionFieldTypePluginSchemaKind,
  registerCollectionFieldTypePlugin,
  resolveCollectionFieldTypePlugin,
  resolveCollectionFieldTypeQueryContract,
  unregisterCollectionFieldTypePlugin
};
