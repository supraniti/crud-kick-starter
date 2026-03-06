const MODULE_FIELD_TYPE_PLUGIN_ENTRYPOINTS = import.meta.glob(
  "../../../../modules/*/frontend/field-type-plugins.mjs",
  {
    eager: true
  }
);

export { MODULE_FIELD_TYPE_PLUGIN_ENTRYPOINTS };
