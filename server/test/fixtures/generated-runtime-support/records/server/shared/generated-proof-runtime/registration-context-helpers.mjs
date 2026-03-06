import { buildCollectionSchemaTypeRegistry } from "./mutation-runtime-helpers.mjs";
import { normalizeCollectionDefinitions } from "./collection-definition-helpers.mjs";
import { normalizeWorkingState } from "./state-and-item-helpers.mjs";

function buildGeneratedRegistrationContext({
  manifest,
  moduleId,
  collections,
  createSchemaTypeRegistry
}) {
  const resolvedModuleId =
    typeof manifest?.id === "string" && manifest.id.trim().length > 0
      ? manifest.id.trim()
      : typeof moduleId === "string" && moduleId.trim().length > 0
        ? moduleId.trim()
        : "generated-module";
  const definitions = normalizeCollectionDefinitions(
    collections,
    resolvedModuleId,
    manifest?.collections
  );
  const fallbackState = normalizeWorkingState({}, definitions);
  const schemaTypeRegistry = buildCollectionSchemaTypeRegistry(
    createSchemaTypeRegistry,
    definitions
  );
  const settingsDefinition =
    manifest?.settings &&
    typeof manifest.settings === "object" &&
    !Array.isArray(manifest.settings)
      ? manifest.settings
      : null;

  return {
    resolvedModuleId,
    definitions,
    fallbackState,
    schemaTypeRegistry,
    settingsDefinition
  };
}

export { buildGeneratedRegistrationContext };
