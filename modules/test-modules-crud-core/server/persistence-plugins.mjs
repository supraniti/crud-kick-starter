import { registerPersistencePlugins as legacyRegistrar0 } from "./runtime-adapters/articles/persistence-plugins.mjs";
import { registerPersistencePlugins as legacyRegistrar1 } from "./runtime-adapters/records/persistence-plugins.mjs";

const TARGET_MODULE_ID = "test-modules-crud-core";
const LEGACY_REGISTRAR_SOURCES = Object.freeze([
  Object.freeze({ legacyModuleId: "articles", register: legacyRegistrar0 }),
  Object.freeze({ legacyModuleId: "records", register: legacyRegistrar1 })
]);

function sanitizePluginIdToken(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  const sanitized = normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized.length > 0 ? sanitized : "legacy";
}

function createModuleIdRewritingRegistry(
  registry,
  { targetModuleId, legacyModuleId, includeSettings }
) {
  if (!registry || typeof registry !== "object" || typeof registry.register !== "function") {
    return registry;
  }
  const pluginSuffix = sanitizePluginIdToken(legacyModuleId);
  const wrappedRegistry = Object.create(registry);
  wrappedRegistry.register = (entry = {}) => {
    const normalizedEntry = entry && typeof entry === "object" ? entry : {};
    const rewrittenPluginId = `${targetModuleId}-${pluginSuffix}-persistence`;
    const rewrittenEntry = {
      ...normalizedEntry,
      pluginId: rewrittenPluginId,
      moduleId: targetModuleId
    };
    if (!includeSettings && Object.prototype.hasOwnProperty.call(rewrittenEntry, "settings")) {
      delete rewrittenEntry.settings;
    }
    return registry.register({
      ...rewrittenEntry
    });
  };
  return wrappedRegistry;
}

export function registerPersistencePlugins(context = {}) {
  for (const [index, source] of LEGACY_REGISTRAR_SOURCES.entries()) {
    if (typeof source.register !== "function") {
      continue;
    }
    const wrappedRegistry = createModuleIdRewritingRegistry(context.registry, {
      targetModuleId: TARGET_MODULE_ID,
      legacyModuleId: source.legacyModuleId,
      includeSettings: index === 0
    });
    const wrappedContext = wrappedRegistry
      ? { ...context, registry: wrappedRegistry }
      : context;
    source.register(wrappedContext);
  }
}

