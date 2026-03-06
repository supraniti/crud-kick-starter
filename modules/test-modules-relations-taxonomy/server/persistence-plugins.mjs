import {
  createGeneratedCollectionsRepository,
  registerGeneratedCollectionPersistencePlugins
} from "../../../server/src/core/shared/capability-contracts/local-kernel/generated-proof-runtime.mjs";

const MODULE_ID = "test-modules-relations-taxonomy";

function createPluginIdRewritingRegistry(registry, pluginId) {
  if (!registry || typeof registry !== "object" || typeof registry.register !== "function") {
    return registry;
  }
  const wrappedRegistry = Object.create(registry);
  wrappedRegistry.register = (entry = {}) => {
    const normalizedEntry = entry && typeof entry === "object" ? entry : {};
    return registry.register({
      ...normalizedEntry,
      pluginId
    });
  };
  return wrappedRegistry;
}

export function registerPersistencePlugins(context = {}) {
  const pluginId = `${MODULE_ID}-authors-persistence`;
  const wrappedRegistry = createPluginIdRewritingRegistry(context.registry, pluginId);
  return registerGeneratedCollectionPersistencePlugins({
    ...context,
    registry: wrappedRegistry,
    moduleId: MODULE_ID,
    persistenceMode: context.persistenceMode
  });
}

export function createTestModulesRelationsTaxonomyRepository(options = {}) {
  return createGeneratedCollectionsRepository({
    ...options,
    moduleId: MODULE_ID,
    persistenceMode: options.persistenceMode
  });
}
