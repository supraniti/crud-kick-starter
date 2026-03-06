import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  createModuleSourcePostureSummary,
  finalizeModuleSourcePostureSummary,
  resolveAndAppendModuleSourceTracking,
  resolveModuleManifestTrackingStatus
} from "../module-source-posture.js";
import {
  listCollectionFieldTypePluginTypes,
  registerCollectionFieldTypePlugin,
  unregisterCollectionFieldTypePlugin
} from "../shared/capability-contracts/collection-field-type-plugin-registry.js";
import { createModuleLoader } from "./lifecycle-runtime.js";

const MODULE_MANIFEST_FILENAME = "module.json";
const FIELD_TYPE_PLUGIN_REGISTRAR_EXPORT_NAME = "registerCollectionFieldTypePlugins";
const DISCOVERY_BASELINE_COLLECTION_FIELD_PLUGIN_TYPES = new Set(
  listCollectionFieldTypePluginTypes()
);

function resetCollectionFieldTypePluginsForDiscovery() {
  for (const pluginType of listCollectionFieldTypePluginTypes()) {
    if (DISCOVERY_BASELINE_COLLECTION_FIELD_PLUGIN_TYPES.has(pluginType)) {
      continue;
    }

    unregisterCollectionFieldTypePlugin(pluginType);
  }
}

function resolveFieldTypePluginEntrypoint({ manifest, modulePath }) {
  const runtimeEntrypoint = manifest?.runtime?.fieldTypePlugins;
  if (typeof runtimeEntrypoint !== "string" || runtimeEntrypoint.trim().length === 0) {
    return null;
  }

  const normalizedEntrypoint = runtimeEntrypoint.trim();
  const absolutePath = path.resolve(modulePath, normalizedEntrypoint);
  const relativePath = path.relative(modulePath, absolutePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return {
      ok: false,
      entrypoint: normalizedEntrypoint,
      resolvedPath: absolutePath
    };
  }

  return {
    ok: true,
    entrypoint: normalizedEntrypoint,
    resolvedPath: absolutePath
  };
}

function resolveFieldTypePluginRegistrarExport(loadedModule) {
  if (typeof loadedModule?.[FIELD_TYPE_PLUGIN_REGISTRAR_EXPORT_NAME] === "function") {
    return loadedModule[FIELD_TYPE_PLUGIN_REGISTRAR_EXPORT_NAME];
  }

  if (Array.isArray(loadedModule?.collectionFieldTypePlugins)) {
    return loadedModule.collectionFieldTypePlugins;
  }

  if (typeof loadedModule?.default === "function") {
    return loadedModule.default;
  }

  if (typeof loadedModule?.default?.[FIELD_TYPE_PLUGIN_REGISTRAR_EXPORT_NAME] === "function") {
    return loadedModule.default[FIELD_TYPE_PLUGIN_REGISTRAR_EXPORT_NAME];
  }

  if (Array.isArray(loadedModule?.default?.collectionFieldTypePlugins)) {
    return loadedModule.default.collectionFieldTypePlugins;
  }

  if (Array.isArray(loadedModule?.default)) {
    return loadedModule.default;
  }

  return null;
}

function normalizeFieldTypePluginList(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return [value];
  }

  return [];
}

function registerFieldTypePluginList({
  moduleId,
  manifestPath,
  entrypoint,
  resolvedPath,
  pluginList,
  diagnostics
}) {
  for (const [pluginIndex, plugin] of pluginList.entries()) {
    const pluginType =
      typeof plugin?.type === "string" && plugin.type.trim().length > 0
        ? plugin.type.trim().toLowerCase()
        : "";
    const registration = registerCollectionFieldTypePlugin(plugin, {
      overwrite: true
    });
    if (registration.ok) {
      continue;
    }

    diagnostics.push({
      code: "COLLECTION_FIELD_TYPE_PLUGIN_REGISTRATION_FAILED",
      message: `Collection field type plugin registration failed for module '${moduleId}'`,
      moduleId,
      path: manifestPath,
      entrypoint,
      resolvedPath,
      pluginIndex,
      ...(pluginType.length > 0 ? { pluginType } : {}),
      reason: registration.reason
    });
  }
}

async function registerCollectionFieldTypePluginsForManifest({
  manifest,
  manifestPath,
  modulePath,
  diagnostics
}) {
  const moduleId = typeof manifest?.id === "string" ? manifest.id : "unknown-module";
  const resolvedEntrypoint = resolveFieldTypePluginEntrypoint({
    manifest,
    modulePath
  });
  if (!resolvedEntrypoint) {
    return;
  }

  if (!resolvedEntrypoint.ok) {
    diagnostics.push({
      code: "COLLECTION_FIELD_TYPE_PLUGIN_REGISTRAR_PATH_INVALID",
      message: `Module '${moduleId}' runtime.fieldTypePlugins must resolve within the module directory`,
      moduleId,
      path: manifestPath,
      entrypoint: resolvedEntrypoint.entrypoint,
      resolvedPath: resolvedEntrypoint.resolvedPath
    });
    return;
  }

  let loadedModule;
  try {
    loadedModule = await import(pathToFileURL(resolvedEntrypoint.resolvedPath).href);
  } catch (error) {
    diagnostics.push({
      code: "COLLECTION_FIELD_TYPE_PLUGIN_REGISTRAR_IMPORT_FAILED",
      message: `Failed loading field type plugin registrar for module '${moduleId}'`,
      moduleId,
      path: manifestPath,
      entrypoint: resolvedEntrypoint.entrypoint,
      resolvedPath: resolvedEntrypoint.resolvedPath,
      errorMessage: error?.message ?? "Unknown import failure"
    });
    return;
  }

  const registrarExport = resolveFieldTypePluginRegistrarExport(loadedModule);
  if (!registrarExport) {
    diagnostics.push({
      code: "COLLECTION_FIELD_TYPE_PLUGIN_REGISTRAR_INVALID_EXPORT",
      message: `Field type plugin registrar for module '${moduleId}' must export '${FIELD_TYPE_PLUGIN_REGISTRAR_EXPORT_NAME}' or 'collectionFieldTypePlugins'`,
      moduleId,
      path: manifestPath,
      entrypoint: resolvedEntrypoint.entrypoint,
      resolvedPath: resolvedEntrypoint.resolvedPath
    });
    return;
  }

  if (typeof registrarExport === "function") {
    try {
      const result = await registrarExport({
        manifest,
        registerCollectionFieldTypePlugin: (plugin, options = {}) =>
          registerCollectionFieldTypePlugin(plugin, {
            overwrite: true,
            ...options
          }),
        listCollectionFieldTypePluginTypes
      });

      const pluginList = normalizeFieldTypePluginList(result);
      if (pluginList.length > 0) {
        registerFieldTypePluginList({
          moduleId,
          manifestPath,
          entrypoint: resolvedEntrypoint.entrypoint,
          resolvedPath: resolvedEntrypoint.resolvedPath,
          pluginList,
          diagnostics
        });
      }
    } catch (error) {
      diagnostics.push({
        code: "COLLECTION_FIELD_TYPE_PLUGIN_REGISTRAR_FAILED",
        message: `Field type plugin registrar failed for module '${moduleId}'`,
        moduleId,
        path: manifestPath,
        entrypoint: resolvedEntrypoint.entrypoint,
        resolvedPath: resolvedEntrypoint.resolvedPath,
        errorMessage: error?.message ?? "Unknown registrar failure"
      });
    }
    return;
  }

  registerFieldTypePluginList({
    moduleId,
    manifestPath,
    entrypoint: resolvedEntrypoint.entrypoint,
    resolvedPath: resolvedEntrypoint.resolvedPath,
    pluginList: normalizeFieldTypePluginList(registrarExport),
    diagnostics
  });
}

function createDiscoveryRuntimeContext(options = {}) {
  const modulesDir =
    typeof options.modulesDir === "string" && options.modulesDir.length > 0
      ? options.modulesDir
      : null;
  const repoRootDir =
    typeof options.repoRootDir === "string" && options.repoRootDir.length > 0
      ? options.repoRootDir
      : modulesDir
        ? path.resolve(modulesDir, "..")
        : null;

  return {
    modulesDir,
    loader: options.loader ?? createModuleLoader({}),
    includeInstall: options.autoInstall === true,
    includeEnable: options.autoEnable === true,
    repoRootDir,
    resolveManifestTrackingStatus:
      typeof options.resolveManifestTrackingStatus === "function"
        ? options.resolveManifestTrackingStatus
        : resolveModuleManifestTrackingStatus,
    sourcePosture: createModuleSourcePostureSummary({
      repoRootDir
    })
  };
}

function missingModulesDirectoryResult(sourcePosture) {
  return {
    ok: false,
    modulesDir: "",
    manifests: [],
    sourcePosture: finalizeModuleSourcePostureSummary(sourcePosture),
    diagnostics: [
      {
        code: "MODULES_DIRECTORY_REQUIRED",
        message: "Module discovery requires a modules directory path",
        path: ""
      }
    ]
  };
}

async function readModuleDirectoryEntries(modulesDir, sourcePosture) {
  try {
    const entries = await fs.readdir(modulesDir, {
      withFileTypes: true
    });
    return {
      ok: true,
      entries
    };
  } catch (error) {
    return {
      ok: false,
      result: {
        ok: false,
        modulesDir,
        manifests: [],
        sourcePosture: finalizeModuleSourcePostureSummary(sourcePosture),
        diagnostics: [
          {
            code: "MODULES_DIRECTORY_READ_FAILED",
            message: error?.message ?? "Failed to read modules directory",
            path: modulesDir
          }
        ]
      }
    };
  }
}

async function collectManifestCandidates(modulesDir, entries, diagnostics) {
  const manifestCandidates = [];
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const directory of directories) {
    const modulePath = path.join(modulesDir, directory.name);
    const manifestPath = path.join(modulePath, MODULE_MANIFEST_FILENAME);

    let manifestRaw;
    try {
      manifestRaw = await fs.readFile(manifestPath, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") {
        continue;
      }
      diagnostics.push({
        code: "MODULE_MANIFEST_READ_FAILED",
        message: error?.message ?? "Failed to read module manifest",
        path: manifestPath
      });
      continue;
    }

    try {
      manifestCandidates.push({
        manifest: JSON.parse(manifestRaw),
        moduleDir: modulePath,
        manifestPath
      });
    } catch (error) {
      diagnostics.push({
        code: "MODULE_MANIFEST_PARSE_FAILED",
        message: error?.message ?? "Failed to parse module manifest json",
        path: manifestPath
      });
    }
  }

  return manifestCandidates;
}

async function processManifestCandidate({
  candidate,
  modulesDir,
  repoRootDir,
  loader,
  includeInstall,
  includeEnable,
  resolveManifestTrackingStatus,
  sourcePosture,
  manifests,
  diagnostics
}) {
  let discoveredManifest;
  try {
    discoveredManifest = loader.discover(candidate.manifest);
  } catch (error) {
    diagnostics.push({
      code: error?.details?.code ?? error?.code ?? "MODULE_DISCOVER_FAILED",
      message: error?.details?.message ?? error?.message ?? "Module discover failed",
      path: candidate.manifestPath
    });
    return;
  }

  discoveredManifest.source = {
    moduleDir: candidate.moduleDir,
    manifestPath: candidate.manifestPath
  };

  const sourceTracking = await resolveAndAppendModuleSourceTracking({
    resolveManifestTrackingStatus,
    sourcePosture,
    moduleId: discoveredManifest.id,
    moduleDir: candidate.moduleDir,
    manifestPath: candidate.manifestPath,
    modulesDir,
    repoRootDir,
    manifest: discoveredManifest
  });
  discoveredManifest.source.tracking = sourceTracking.tracking;
  discoveredManifest.source.trackingReason = sourceTracking.trackingReason;

  const installResult = await installDiscoveredManifestIfRequired({
    includeInstall,
    loader,
    discoveredManifestId: discoveredManifest.id,
    manifestPath: candidate.manifestPath,
    diagnostics
  });
  if (!installResult.ok) {
    return;
  }

  const enableResult = enableDiscoveredManifestIfRequired({
    includeEnable,
    loader,
    discoveredManifestId: discoveredManifest.id,
    manifestPath: candidate.manifestPath,
    diagnostics
  });
  if (!enableResult.ok) {
    return;
  }

  manifests.push(discoveredManifest);
}

async function installDiscoveredManifestIfRequired({
  includeInstall,
  loader,
  discoveredManifestId,
  manifestPath,
  diagnostics
}) {
  if (!includeInstall) {
    return { ok: true };
  }

  try {
    await loader.install(discoveredManifestId);
    return { ok: true };
  } catch (error) {
    diagnostics.push({
      code: error?.code ?? "MODULE_INSTALL_FAILED",
      message: error?.message ?? "Module install failed",
      path: manifestPath
    });
    return { ok: false };
  }
}

function enableDiscoveredManifestIfRequired({
  includeEnable,
  loader,
  discoveredManifestId,
  manifestPath,
  diagnostics
}) {
  if (!includeEnable) {
    return { ok: true };
  }

  try {
    loader.registry.enable(discoveredManifestId);
    return { ok: true };
  } catch (error) {
    diagnostics.push({
      code: error?.code ?? "MODULE_ENABLE_FAILED",
      message: error?.message ?? "Module enable failed",
      path: manifestPath
    });
    return { ok: false };
  }
}

async function discoverModulesFromDirectory(options = {}) {
  const context = createDiscoveryRuntimeContext(options);
  if (!context.modulesDir) {
    return missingModulesDirectoryResult(context.sourcePosture);
  }

  const directoryEntriesResult = await readModuleDirectoryEntries(
    context.modulesDir,
    context.sourcePosture
  );
  if (!directoryEntriesResult.ok) {
    return directoryEntriesResult.result;
  }

  const manifests = [];
  const diagnostics = [];
  const manifestCandidates = await collectManifestCandidates(
    context.modulesDir,
    directoryEntriesResult.entries,
    diagnostics
  );

  resetCollectionFieldTypePluginsForDiscovery();
  for (const candidate of manifestCandidates) {
    await registerCollectionFieldTypePluginsForManifest({
      manifest: candidate.manifest,
      manifestPath: candidate.manifestPath,
      modulePath: candidate.moduleDir,
      diagnostics
    });
  }

  for (const candidate of manifestCandidates) {
    await processManifestCandidate({
      candidate,
      modulesDir: context.modulesDir,
      repoRootDir: context.repoRootDir,
      loader: context.loader,
      includeInstall: context.includeInstall,
      includeEnable: context.includeEnable,
      resolveManifestTrackingStatus: context.resolveManifestTrackingStatus,
      sourcePosture: context.sourcePosture,
      manifests,
      diagnostics
    });
  }

  return {
    ok: diagnostics.length === 0,
    modulesDir: context.modulesDir,
    manifests,
    sourcePosture: finalizeModuleSourcePostureSummary(context.sourcePosture),
    diagnostics
  };
}

export { discoverModulesFromDirectory };
