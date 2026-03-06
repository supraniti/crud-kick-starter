function createRuntimeDefinitionNormalizer({
  validationError
}) {
  function normalizeRuntimeDefinition(runtime) {
    if (runtime === undefined) {
      return {
        ok: true,
        value: {}
      };
    }

    if (!runtime || typeof runtime !== "object" || Array.isArray(runtime)) {
      return {
        ok: false,
        error: validationError(
          "MODULE_MANIFEST_INVALID",
          "Runtime definition must be an object",
          "runtime"
        )
      };
    }

    const normalized = {};
    const runtimeAllowedKeys = new Set([
      "collectionHandlers",
      "services",
      "missions",
      "persistence",
      "fieldTypePlugins",
      "referenceOptionsProviders"
    ]);
    const unknownRuntimeKey = Object.keys(runtime).find((key) => !runtimeAllowedKeys.has(key));
    if (unknownRuntimeKey) {
      return {
        ok: false,
        error: validationError(
          "MODULE_MANIFEST_INVALID",
          `Runtime field '${unknownRuntimeKey}' is not supported`,
          `runtime.${unknownRuntimeKey}`
        )
      };
    }

    const runtimePathFields = [
      {
        key: "collectionHandlers",
        field: "runtime.collectionHandlers"
      },
      {
        key: "services",
        field: "runtime.services"
      },
      {
        key: "missions",
        field: "runtime.missions"
      },
      {
        key: "persistence",
        field: "runtime.persistence"
      },
      {
        key: "fieldTypePlugins",
        field: "runtime.fieldTypePlugins"
      },
      {
        key: "referenceOptionsProviders",
        field: "runtime.referenceOptionsProviders"
      }
    ];

    for (const runtimePathField of runtimePathFields) {
      const value = runtime[runtimePathField.key];
      if (value === undefined) {
        continue;
      }

      if (typeof value !== "string" || value.trim().length === 0) {
        return {
          ok: false,
          error: validationError(
            "MODULE_MANIFEST_INVALID",
            `Runtime ${runtimePathField.key} must be a non-empty string when provided`,
            runtimePathField.field
          )
        };
      }

      normalized[runtimePathField.key] = value.trim();
    }

    return {
      ok: true,
      value: normalized
    };
  }

  return {
    normalizeRuntimeDefinition
  };
}

export { createRuntimeDefinitionNormalizer };
