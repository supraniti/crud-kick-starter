import path from "node:path";
import { pathToFileURL } from "node:url";

const REGISTRAR_EXPORT_NAME = "registerReferenceOptionsProviders";

function shouldAttemptReferenceOptionsProviderRegistrar(manifest) {
  return typeof manifest?.runtime?.referenceOptionsProviders === "string";
}

function resolveRegistrarEntrypoint(manifest) {
  const runtimeEntrypoint = manifest?.runtime?.referenceOptionsProviders;
  if (typeof runtimeEntrypoint !== "string" || runtimeEntrypoint.length === 0) {
    return {
      ok: false,
      code: "REFERENCE_OPTIONS_PROVIDER_REGISTRAR_NOT_FOUND",
      message: `Module '${manifest?.id}' declares reference options providers but runtime.referenceOptionsProviders is not configured`
    };
  }

  const moduleDir = manifest?.source?.moduleDir;
  if (typeof moduleDir !== "string" || moduleDir.length === 0) {
    return {
      ok: false,
      code: "REFERENCE_OPTIONS_PROVIDER_REGISTRAR_SOURCE_MISSING",
      message: `Module '${manifest?.id}' runtime source directory is missing`
    };
  }

  const absolutePath = path.resolve(moduleDir, runtimeEntrypoint);
  const relativePath = path.relative(moduleDir, absolutePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return {
      ok: false,
      code: "REFERENCE_OPTIONS_PROVIDER_REGISTRAR_PATH_INVALID",
      message: `Module '${manifest?.id}' runtime.referenceOptionsProviders must resolve within the module directory`,
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

export async function registerReferenceOptionsProvidersForDiscoveredModules({
  moduleRegistry,
  referenceOptionsProviderRegistry,
  registrationContext
}) {
  const diagnostics = [];

  for (const { manifest } of moduleRegistry.list()) {
    if (!shouldAttemptReferenceOptionsProviderRegistrar(manifest)) {
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
        code: "REFERENCE_OPTIONS_PROVIDER_REGISTRAR_IMPORT_FAILED",
        message: `Failed loading reference options provider registrar for module '${manifest.id}'`,
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
        code: "REFERENCE_OPTIONS_PROVIDER_REGISTRAR_INVALID_EXPORT",
        message: `Reference options provider registrar for module '${manifest.id}' must export '${REGISTRAR_EXPORT_NAME}'`,
        moduleId: manifest.id,
        entrypoint: resolvedEntrypoint.entrypoint,
        resolvedPath: resolvedEntrypoint.resolvedPath
      });
      continue;
    }

    try {
      await registrar({
        registry: referenceOptionsProviderRegistry,
        manifest,
        ...registrationContext
      });
    } catch (error) {
      diagnostics.push({
        code: "REFERENCE_OPTIONS_PROVIDER_REGISTRAR_FAILED",
        message: `Reference options provider registrar failed for module '${manifest.id}'`,
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
