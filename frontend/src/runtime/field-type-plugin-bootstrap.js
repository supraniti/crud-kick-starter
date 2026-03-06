import { MODULE_FIELD_TYPE_PLUGIN_ENTRYPOINTS } from "./module-discovery-bridges/module-field-type-plugin-entrypoints.mjs";

function listLoadedModuleFieldTypePluginEntrypoints() {
  return Object.keys(MODULE_FIELD_TYPE_PLUGIN_ENTRYPOINTS).sort((left, right) =>
    left.localeCompare(right)
  );
}

export { listLoadedModuleFieldTypePluginEntrypoints };
