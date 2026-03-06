import { isRepository } from "./generated-proof-runtime/query-and-reference-helpers.mjs";
import {
  resolveGeneratedModulePersistencePolicy
} from "./generated-proof-runtime/collection-definition-helpers.mjs";
import {
  createGeneratedRuntimeStateAccess
} from "./generated-proof-runtime/handler-runtime-helpers.mjs";
import { resolveGeneratedModuleSettingsValues } from "./generated-proof-runtime/module-settings-runtime-helpers.mjs";
import { buildGeneratedRegistrationContext } from "./generated-proof-runtime/registration-context-helpers.mjs";
import {
  createGeneratedCollectionHandler,
  resolvePrimaryFieldId
} from "./generated-proof-runtime/collection-handler-runtime.mjs";

export {
  createGeneratedCollectionsRepository,
  registerGeneratedCollectionPersistencePlugins
} from "./generated-proof-runtime/persistence-runtime-helpers.mjs";

export { resolveGeneratedModulePersistencePolicy };

export function registerGeneratedCollectionHandlers({
  registry,
  manifest,
  state,
  createMutationPipeline,
  createSchemaTypeRegistry,
  badRequest,
  resolveCollectionRepository,
  resolveProviderValidationRows,
  resolveSettingsRepository,
  moduleId,
  collections
}) {
  if (typeof createMutationPipeline !== "function") {
    throw new Error("createMutationPipeline is required for generated collection handlers");
  }

  const {
    resolvedModuleId,
    definitions,
    fallbackState,
    schemaTypeRegistry,
    settingsDefinition
  } = buildGeneratedRegistrationContext({
    manifest,
    moduleId,
    collections,
    createSchemaTypeRegistry
  });
  const readModuleSettingsValues = async () =>
    resolveGeneratedModuleSettingsValues({
      moduleId: resolvedModuleId,
      settingsDefinition,
      resolveSettingsRepository
    });
  const { readWorkingState, mutateWorkingState } = createGeneratedRuntimeStateAccess({
    definitions,
    fallbackState,
    readModuleSettingsValues
  });
  const primaryFieldByCollection = new Map(
    definitions.map((definition) => [definition.collectionId, resolvePrimaryFieldId(definition)])
  );

  for (const definition of definitions) {
    const pluginRepository =
      typeof resolveCollectionRepository === "function"
        ? resolveCollectionRepository(definition.collectionId)
        : null;
    const repository = isRepository(pluginRepository) ? pluginRepository : null;

    registry.register({
      collectionId: definition.collectionId,
      moduleId: resolvedModuleId,
      handler: createGeneratedCollectionHandler({
        definition,
        repository,
        readWorkingState,
        mutateWorkingState,
        createMutationPipeline,
        schemaTypeRegistry,
        state,
        resolveCollectionRepository,
        resolveProviderValidationRows,
        primaryFieldByCollection,
        badRequest
      })
    });
  }
}
