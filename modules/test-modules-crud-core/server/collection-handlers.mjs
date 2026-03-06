import { registerCollectionHandlers as legacyRegistrar0 } from "./runtime-adapters/articles/collection-handlers.mjs";
import { registerCollectionHandlers as legacyRegistrar1 } from "./runtime-adapters/records/collection-handlers.mjs";

const TARGET_MODULE_ID = "test-modules-crud-core";
const LEGACY_REGISTRAR_SOURCES = Object.freeze([
  Object.freeze({ legacyModuleId: "articles", register: legacyRegistrar0 }),
  Object.freeze({ legacyModuleId: "records", register: legacyRegistrar1 })
]);

function createModuleIdRewritingRegistry(registry, targetModuleId) {
  if (!registry || typeof registry !== "object" || typeof registry.register !== "function") {
    return registry;
  }
  const wrappedRegistry = Object.create(registry);
  wrappedRegistry.register = (entry = {}) => {
    const normalizedEntry = entry && typeof entry === "object" ? entry : {};
    return registry.register({
      ...normalizedEntry,
      moduleId: targetModuleId
    });
  };
  return wrappedRegistry;
}

export function registerCollectionHandlers(context = {}) {
  const wrappedRegistry = createModuleIdRewritingRegistry(context.registry, TARGET_MODULE_ID);
  const wrappedContext = wrappedRegistry
    ? { ...context, registry: wrappedRegistry }
    : context;
  for (const source of LEGACY_REGISTRAR_SOURCES) {
    if (typeof source.register !== "function") {
      continue;
    }
    source.register(wrappedContext);
  }
}

