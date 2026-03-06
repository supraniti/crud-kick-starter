import fs from "node:fs/promises";
import path from "node:path";
import { cloneValue } from "./shared-utils.mjs";
import { isRepository } from "./query-and-reference-helpers.mjs";
import { resolveGeneratedModuleSettingsValues } from "./module-settings-runtime-helpers.mjs";
import {
  normalizeCollectionDefinitions,
  resolveGeneratedModulePersistencePolicy
} from "./collection-definition-helpers.mjs";
import { normalizeWorkingState } from "./state-and-item-helpers.mjs";

function createGeneratedCollectionsRepository({
  moduleId,
  collections,
  manifestCollections,
  stateFilePath,
  initialState = {},
  persistenceMode,
  resolveModuleSettingsValues
} = {}) {
  const normalizedModuleId =
    typeof moduleId === "string" && moduleId.trim().length > 0
      ? moduleId.trim()
      : "generated-module";
  const definitions = normalizeCollectionDefinitions(
    collections,
    normalizedModuleId,
    manifestCollections
  );
  const policy = resolveGeneratedModulePersistencePolicy({
    moduleId: normalizedModuleId,
    persistenceMode
  });
  const resolvedStateFilePath =
    typeof stateFilePath === "string" && stateFilePath.length > 0
      ? stateFilePath
      : path.resolve(
          process.cwd(),
          "server",
          "runtime",
          "module-data",
          `${normalizedModuleId}-state.json`
        );
  let snapshot = normalizeWorkingState(initialState, definitions);
  let initialized = false;
  let writeQueue = Promise.resolve();
  const readModuleSettingsValues = async () =>
    typeof resolveModuleSettingsValues === "function"
      ? await resolveModuleSettingsValues()
      : null;
  const normalizeState = async (rawState, fallbackState = null) =>
    normalizeWorkingState(rawState, definitions, fallbackState, {
      moduleSettingsValues: await readModuleSettingsValues()
    });

  async function ensureInitialized() {
    if (initialized) {
      return;
    }

    if (policy.runtimeMode !== "file") {
      initialized = true;
      return;
    }

    try {
      const raw = await fs.readFile(resolvedStateFilePath, "utf8");
      const parsed = JSON.parse(raw);
      snapshot = await normalizeState(parsed, snapshot);
      initialized = true;
      return;
    } catch (error) {
      if (error?.code === "ENOENT") {
        initialized = true;
        return;
      }

      throw error;
    }
  }

  async function persistSnapshot() {
    if (policy.runtimeMode !== "file") {
      return;
    }

    await fs.mkdir(path.dirname(resolvedStateFilePath), {
      recursive: true
    });
    await fs.writeFile(resolvedStateFilePath, JSON.stringify(snapshot, null, 2), "utf8");
  }

  async function readState() {
    await ensureInitialized();
    snapshot = await normalizeState(snapshot, snapshot);
    return cloneValue(snapshot);
  }

  async function transact(mutator) {
    const run = async () => {
      await ensureInitialized();
      const workingState = cloneValue(snapshot);
      const normalized = await normalizeState(workingState, snapshot);
      for (const [key, value] of Object.entries(normalized)) {
        workingState[key] = value;
      }
      const outcome = await mutator(workingState);
      if (outcome?.commit === true) {
        snapshot = await normalizeState(workingState, snapshot);
        await persistSnapshot();
      }

      return Object.prototype.hasOwnProperty.call(outcome ?? {}, "value")
        ? outcome.value
        : outcome;
    };

    const operation = writeQueue.then(run, run);
    writeQueue = operation.then(
      () => undefined,
      () => undefined
    );
    return operation;
  }

  return {
    readState,
    transact,
    describePolicy() {
      return {
        configuredMode: policy.configuredMode,
        runtimeMode: policy.runtimeMode,
        mode: policy.runtimeMode,
        source: policy.source,
        stateFilePath: policy.runtimeMode === "file" ? resolvedStateFilePath : null
      };
    }
  };
}

function registerGeneratedCollectionPersistencePlugins({
  registry,
  manifest,
  moduleSettingsRepository,
  moduleId,
  collections,
  stateFilePath,
  persistenceMode
}) {
  const resolvedModuleId =
    typeof manifest?.id === "string" && manifest.id.trim().length > 0
      ? manifest.id.trim()
      : typeof moduleId === "string" && moduleId.trim().length > 0
        ? moduleId.trim()
        : "generated-module";
  const definitions = normalizeCollectionDefinitions(
    collections,
    resolvedModuleId,
    manifest?.collections
  );
  const moduleDir = manifest?.source?.moduleDir;
  const resolvedStateFilePath =
    typeof stateFilePath === "string" && stateFilePath.length > 0
      ? stateFilePath
      : typeof moduleDir === "string" && moduleDir.length > 0
        ? path.resolve(
            moduleDir,
            "..",
            "..",
            "server",
            "runtime",
            "module-data",
            `${resolvedModuleId}-state.json`
          )
        : undefined;
  const repository = createGeneratedCollectionsRepository({
    moduleId: resolvedModuleId,
    // Reuse raw collection descriptors here to avoid re-normalizing
    // already-normalized definitions with conflicting legacy title keys.
    collections,
    manifestCollections: manifest?.collections,
    stateFilePath: resolvedStateFilePath,
    persistenceMode,
    resolveModuleSettingsValues: async () =>
      resolveGeneratedModuleSettingsValues({
        moduleId: resolvedModuleId,
        settingsDefinition: manifest?.settings,
        resolveSettingsRepository: () =>
          isRepository(moduleSettingsRepository) ? moduleSettingsRepository : null
      })
  });

  registry.register({
    pluginId: `${resolvedModuleId}-persistence`,
    moduleId: resolvedModuleId,
    collections: definitions.map((definition) => ({
      collectionId: definition.collectionId,
      repository
    })),
    ...(isRepository(moduleSettingsRepository)
      ? {
          settings: {
            repository: moduleSettingsRepository
          }
        }
      : {})
  });

  return {
    repository
  };
}

export {
  createGeneratedCollectionsRepository,
  registerGeneratedCollectionPersistencePlugins
};
