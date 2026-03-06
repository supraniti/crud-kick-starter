import { validateModuleManifest } from "./manifest-validation.js";

const MODULE_LIFECYCLE_STATES = [
  "discovered",
  "installed",
  "enabled",
  "disabled",
  "failed",
  "uninstalled"
];

const MODULE_LIFECYCLE_STATE_SET = new Set(MODULE_LIFECYCLE_STATES);

function lifecycleError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function resolveManifestRouteSegment(manifest) {
  const routeSegment = manifest?.ui?.navigation?.routeSegment;
  if (typeof routeSegment === "string" && routeSegment.length > 0) {
    return routeSegment;
  }

  return manifest.id;
}

function createModuleRegistry() {
  const manifests = new Map();
  const states = new Map();
  const routeSegmentOwners = new Map();

  function assertDiscovered(id) {
    if (!manifests.has(id)) {
      throw lifecycleError("MODULE_NOT_DISCOVERED", `Module ${id} not discovered`);
    }
  }

  function assertInstalled(id) {
    assertDiscovered(id);
    const state = states.get(id);
    if (!state || state === "discovered" || state === "uninstalled") {
      throw lifecycleError("MODULE_NOT_INSTALLED", `Module ${id} is not installed`);
    }
  }

  function assertKnownState(nextState) {
    if (!MODULE_LIFECYCLE_STATE_SET.has(nextState)) {
      throw lifecycleError("MODULE_STATE_INVALID", `Unknown module state '${nextState}'`);
    }
  }

  return {
    discover(manifest) {
      const validation = validateModuleManifest(manifest);
      if (!validation.ok) {
        const error = lifecycleError("MODULE_MANIFEST_INVALID", validation.error.message);
        error.details = validation.error;
        throw error;
      }

      const moduleId = validation.value.id;
      if (manifests.has(moduleId)) {
        throw lifecycleError(
          "MODULE_ALREADY_DISCOVERED",
          `Module '${moduleId}' has already been discovered`
        );
      }

      const routeSegment = resolveManifestRouteSegment(validation.value);
      const firstModuleId = routeSegmentOwners.get(routeSegment);
      if (firstModuleId) {
        const error = lifecycleError(
          "MODULE_ROUTE_SEGMENT_DUPLICATE",
          `Route segment '${routeSegment}' from module '${moduleId}' conflicts with module '${firstModuleId}'`
        );
        error.details = {
          code: "MODULE_ROUTE_SEGMENT_DUPLICATE",
          message: error.message,
          field: "ui.navigation.routeSegment",
          routeSegment,
          moduleId,
          firstModuleId
        };
        throw error;
      }

      manifests.set(moduleId, validation.value);
      states.set(moduleId, "discovered");
      routeSegmentOwners.set(routeSegment, moduleId);
      return validation.value;
    },
    install(id) {
      assertDiscovered(id);
      states.set(id, "installed");
      return states.get(id);
    },
    uninstall(id) {
      assertDiscovered(id);
      states.set(id, "uninstalled");
      return states.get(id);
    },
    enable(id) {
      assertInstalled(id);
      states.set(id, "enabled");
      return states.get(id);
    },
    disable(id) {
      assertInstalled(id);
      states.set(id, "disabled");
      return states.get(id);
    },
    fail(id) {
      assertDiscovered(id);
      states.set(id, "failed");
      return states.get(id);
    },
    setState(id, nextState) {
      assertDiscovered(id);
      assertKnownState(nextState);
      states.set(id, nextState);
      return states.get(id);
    },
    getState(id) {
      return states.get(id) ?? null;
    },
    getManifest(id) {
      return manifests.get(id) ?? null;
    },
    list() {
      return Array.from(manifests.values()).map((manifest) => ({
        manifest,
        state: states.get(manifest.id) ?? null
      }));
    }
  };
}

function createModuleLoader({ registry, hookExecutor }) {
  const resolvedRegistry = registry ?? createModuleRegistry();
  const executeHook =
    hookExecutor ??
    (async () => {
      return { ok: true };
    });

  return {
    registry: resolvedRegistry,
    discover(manifest) {
      return resolvedRegistry.discover(manifest);
    },
    async install(id) {
      const manifest = resolvedRegistry.getManifest(id);
      if (!manifest) {
        throw lifecycleError("MODULE_NOT_DISCOVERED", `Module ${id} not discovered`);
      }

      const hookResult = await executeHook(manifest.lifecycle.install, {
        moduleId: id
      });

      if (!hookResult?.ok) {
        resolvedRegistry.fail(id);
        throw lifecycleError("MODULE_INSTALL_HOOK_FAILED", `Install hook failed for module ${id}`);
      }

      resolvedRegistry.install(id);
      return resolvedRegistry.getState(id);
    },
    async uninstall(id) {
      const manifest = resolvedRegistry.getManifest(id);
      if (!manifest) {
        throw lifecycleError("MODULE_NOT_DISCOVERED", `Module ${id} not discovered`);
      }

      const hookResult = await executeHook(manifest.lifecycle.uninstall, {
        moduleId: id
      });

      if (!hookResult?.ok) {
        resolvedRegistry.fail(id);
        throw lifecycleError(
          "MODULE_UNINSTALL_HOOK_FAILED",
          `Uninstall hook failed for module ${id}`
        );
      }

      resolvedRegistry.uninstall(id);
      return resolvedRegistry.getState(id);
    }
  };
}

export { MODULE_LIFECYCLE_STATES, createModuleLoader, createModuleRegistry };
