import { registerMissions as legacyRegistrar0 } from "./runtime-adapters/remotes-runtime-services.mjs";
import { registerMissions as legacyRegistrar1 } from "./runtime-adapters/publish-jobs-runtime-services.mjs";

const TARGET_MODULE_ID = "test-modules-remotes-publish";
const LEGACY_REGISTRAR_SOURCES = Object.freeze([
  Object.freeze({ legacyModuleId: "remotes", register: legacyRegistrar0 }),
  Object.freeze({ legacyModuleId: "wpx-publish-jobs", register: legacyRegistrar1 })
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

export function registerMissions(context = {}) {
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
