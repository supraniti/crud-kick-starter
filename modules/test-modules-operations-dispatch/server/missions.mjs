import { registerMissions as legacyRegistrar0 } from "./runtime-adapters/iter1-dispatches-runtime-services.mjs";
import { registerMissions as legacyRegistrar1 } from "./runtime-adapters/iter2-executions-runtime-services.mjs";
import { registerMissions as legacyRegistrar2 } from "./runtime-adapters/iter3-drill-runs-runtime-services.mjs";
import { registerMissions as legacyRegistrar3 } from "./runtime-adapters/iter4-dispatch-runs-runtime-services.mjs";
import { registerMissions as legacyRegistrar4 } from "./runtime-adapters/iter5-playbook-runs-runtime-services.mjs";

const TARGET_MODULE_ID = "test-modules-operations-dispatch";
const LEGACY_REGISTRAR_SOURCES = Object.freeze([
  Object.freeze({ legacyModuleId: "iter1-dispatches", register: legacyRegistrar0 }),
  Object.freeze({ legacyModuleId: "iter2-executions", register: legacyRegistrar1 }),
  Object.freeze({ legacyModuleId: "iter3-drill-runs", register: legacyRegistrar2 }),
  Object.freeze({ legacyModuleId: "iter4-dispatch-runs", register: legacyRegistrar3 }),
  Object.freeze({ legacyModuleId: "iter5-playbook-runs", register: legacyRegistrar4 })
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
