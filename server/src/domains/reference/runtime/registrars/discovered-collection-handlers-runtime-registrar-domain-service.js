import path from "node:path";
import { pathToFileURL } from "node:url";

const REGISTRAR_EXPORT_NAME = "registerCollectionHandlers";

function collectionIdsFromManifest(manifest) {
  if (!Array.isArray(manifest?.collections)) {
    return [];
  }

  return manifest.collections
    .map((collection) => collection?.id)
    .filter((collectionId) => typeof collectionId === "string" && collectionId.length > 0);
}

function resolveRegistrarEntrypoint(manifest) {
  const runtimeEntrypoint = manifest?.runtime?.collectionHandlers;
  if (typeof runtimeEntrypoint !== "string" || runtimeEntrypoint.length === 0) {
    return {
      ok: false,
      code: "COLLECTION_HANDLER_REGISTRAR_NOT_FOUND",
      message: `Module '${manifest?.id}' declares collection handlers but runtime.collectionHandlers is not configured`
    };
  }

  const moduleDir = manifest?.source?.moduleDir;
  if (typeof moduleDir !== "string" || moduleDir.length === 0) {
    return {
      ok: false,
      code: "COLLECTION_HANDLER_REGISTRAR_SOURCE_MISSING",
      message: `Module '${manifest?.id}' runtime source directory is missing`
    };
  }

  const absolutePath = path.resolve(moduleDir, runtimeEntrypoint);
  const relativePath = path.relative(moduleDir, absolutePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return {
      ok: false,
      code: "COLLECTION_HANDLER_REGISTRAR_PATH_INVALID",
      message: `Module '${manifest?.id}' runtime.collectionHandlers must resolve within the module directory`,
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

export async function registerCollectionHandlersForDiscoveredModules({
  moduleRegistry,
  collectionHandlerRegistry,
  registrationContext
}) {
  const diagnostics = [];

  for (const { manifest } of moduleRegistry.list()) {
    const declaredCollectionIds = collectionIdsFromManifest(manifest);
    if (declaredCollectionIds.length === 0) {
      continue;
    }

    const resolvedEntrypoint = resolveRegistrarEntrypoint(manifest);
    if (!resolvedEntrypoint.ok) {
      diagnostics.push({
        code: resolvedEntrypoint.code,
        message: resolvedEntrypoint.message,
        moduleId: manifest.id,
        collectionIds: declaredCollectionIds
      });
      continue;
    }

    let loadedModule;
    try {
      loadedModule = await import(pathToFileURL(resolvedEntrypoint.resolvedPath).href);
    } catch (error) {
      diagnostics.push({
        code: "COLLECTION_HANDLER_REGISTRAR_IMPORT_FAILED",
        message: `Failed loading collection handler registrar for module '${manifest.id}'`,
        moduleId: manifest.id,
        collectionIds: declaredCollectionIds,
        entrypoint: resolvedEntrypoint.entrypoint,
        resolvedPath: resolvedEntrypoint.resolvedPath,
        errorMessage: error?.message ?? "Unknown import failure"
      });
      continue;
    }

    const registrar = resolveRegistrarExport(loadedModule);
    if (typeof registrar !== "function") {
      diagnostics.push({
        code: "COLLECTION_HANDLER_REGISTRAR_INVALID_EXPORT",
        message: `Collection handler registrar for module '${manifest.id}' must export '${REGISTRAR_EXPORT_NAME}'`,
        moduleId: manifest.id,
        collectionIds: declaredCollectionIds,
        entrypoint: resolvedEntrypoint.entrypoint,
        resolvedPath: resolvedEntrypoint.resolvedPath
      });
      continue;
    }

    try {
      await registrar({
        registry: collectionHandlerRegistry,
        manifest,
        ...registrationContext
      });
    } catch (error) {
      diagnostics.push({
        code: "COLLECTION_HANDLER_REGISTRAR_FAILED",
        message: `Collection handler registrar failed for module '${manifest.id}'`,
        moduleId: manifest.id,
        collectionIds: declaredCollectionIds,
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
