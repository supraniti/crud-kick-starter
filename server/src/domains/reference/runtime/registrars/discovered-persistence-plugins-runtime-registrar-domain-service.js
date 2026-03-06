import path from "node:path";
import { pathToFileURL } from "node:url";

const REGISTRAR_EXPORT_NAME = "registerPersistencePlugins";

function shouldAttemptPersistenceRegistrar(manifest) {
  const hasRuntimeEntrypoint = typeof manifest?.runtime?.persistence === "string";
  const hasCollections =
    Array.isArray(manifest?.collections) && manifest.collections.length > 0;
  const hasSettings =
    manifest?.settings &&
    typeof manifest.settings === "object" &&
    Array.isArray(manifest.settings.fields) &&
    manifest.settings.fields.length > 0;

  return hasRuntimeEntrypoint || hasCollections || hasSettings;
}

function resolveRegistrarEntrypoint(manifest) {
  const runtimeEntrypoint = manifest?.runtime?.persistence;
  if (typeof runtimeEntrypoint !== "string" || runtimeEntrypoint.length === 0) {
    return {
      ok: false,
      code: "PERSISTENCE_REGISTRAR_NOT_FOUND",
      message: `Module '${manifest?.id}' declares persistence ownership but runtime.persistence is not configured`
    };
  }

  const moduleDir = manifest?.source?.moduleDir;
  if (typeof moduleDir !== "string" || moduleDir.length === 0) {
    return {
      ok: false,
      code: "PERSISTENCE_REGISTRAR_SOURCE_MISSING",
      message: `Module '${manifest?.id}' runtime source directory is missing`
    };
  }

  const absolutePath = path.resolve(moduleDir, runtimeEntrypoint);
  const relativePath = path.relative(moduleDir, absolutePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return {
      ok: false,
      code: "PERSISTENCE_REGISTRAR_PATH_INVALID",
      message: `Module '${manifest?.id}' runtime.persistence must resolve within the module directory`,
      entrypoint: runtimeEntrypoint,
      resolvedPath: absolutePath
    };
  }

  return {
    ok: true,
    entrypoint: runtimeEntrypoint,
    resolvedPath: absolutePath
  };
}

function resolveRegistrarExport(loadedModule) {
  if (typeof loadedModule?.[REGISTRAR_EXPORT_NAME] === "function") {
    return loadedModule[REGISTRAR_EXPORT_NAME];
  }

  if (typeof loadedModule?.default === "function") {
    return loadedModule.default;
  }

  if (typeof loadedModule?.default?.[REGISTRAR_EXPORT_NAME] === "function") {
    return loadedModule.default[REGISTRAR_EXPORT_NAME];
  }

  return null;
}

export async function registerPersistencePluginsForDiscoveredModules({
  moduleRegistry,
  persistencePluginRegistry,
  registrationContext
}) {
  const diagnostics = [];

  for (const { manifest } of moduleRegistry.list()) {
    if (!shouldAttemptPersistenceRegistrar(manifest)) {
      continue;
    }

    const resolvedEntrypoint = resolveRegistrarEntrypoint(manifest);
    if (!resolvedEntrypoint.ok) {
      diagnostics.push({
        code: resolvedEntrypoint.code,
        message: resolvedEntrypoint.message,
        moduleId: manifest.id
      });
      continue;
    }

    let loadedModule;
    try {
      loadedModule = await import(pathToFileURL(resolvedEntrypoint.resolvedPath).href);
    } catch (error) {
      diagnostics.push({
        code: "PERSISTENCE_REGISTRAR_IMPORT_FAILED",
        message: `Failed loading persistence registrar for module '${manifest.id}'`,
        moduleId: manifest.id,
        entrypoint: resolvedEntrypoint.entrypoint,
        resolvedPath: resolvedEntrypoint.resolvedPath,
        errorMessage: error?.message ?? "Unknown import failure"
      });
      continue;
    }

    const registrar = resolveRegistrarExport(loadedModule);
    if (typeof registrar !== "function") {
      diagnostics.push({
        code: "PERSISTENCE_REGISTRAR_INVALID_EXPORT",
        message: `Persistence registrar for module '${manifest.id}' must export '${REGISTRAR_EXPORT_NAME}'`,
        moduleId: manifest.id,
        entrypoint: resolvedEntrypoint.entrypoint,
        resolvedPath: resolvedEntrypoint.resolvedPath
      });
      continue;
    }

    try {
      await registrar({
        registry: persistencePluginRegistry,
        manifest,
        ...registrationContext
      });
    } catch (error) {
      diagnostics.push({
        code: "PERSISTENCE_REGISTRAR_FAILED",
        message: `Persistence registrar failed for module '${manifest.id}'`,
        moduleId: manifest.id,
        entrypoint: resolvedEntrypoint.entrypoint,
        resolvedPath: resolvedEntrypoint.resolvedPath,
        errorMessage: error?.message ?? "Unknown registrar failure"
      });
    }
  }

  return {
    diagnostics
  };
}
