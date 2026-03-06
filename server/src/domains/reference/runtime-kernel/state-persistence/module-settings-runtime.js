function createReadModuleSettingsSnapshot(runtime) {
  return async function readModuleSettingsSnapshot(fallbackSnapshot = {}) {
    const normalizedFallback = runtime.normalizeModuleSettingsSnapshot(
      fallbackSnapshot,
      fallbackSnapshot
    );
    const runtimeMode = runtime.getRuntimeMode();

    if (!runtime.enabled || runtimeMode === "disabled") {
      runtime.setRuntimeMode("disabled");
      return runtime.normalizeModuleSettingsSnapshot(
        runtime.getMemorySnapshot() ?? normalizedFallback,
        normalizedFallback
      );
    }

    if (runtimeMode === "memory" || runtimeMode === "memory-fallback") {
      const nextMemorySnapshot = runtime.normalizeModuleSettingsSnapshot(
        runtime.getMemorySnapshot() ?? normalizedFallback,
        normalizedFallback
      );
      runtime.setMemorySnapshot(nextMemorySnapshot);
      return runtime.normalizeModuleSettingsSnapshot(nextMemorySnapshot, normalizedFallback);
    }

    try {
      const targetCollection = await runtime.ensureMongoCollection();
      const document = await targetCollection.findOne({
        _id: runtime.moduleSettingsDocumentId
      });

      if (!document) {
        const seeded = runtime.normalizeModuleSettingsSnapshot(
          normalizedFallback,
          normalizedFallback
        );
        await targetCollection.insertOne({
          _id: runtime.moduleSettingsDocumentId,
          settings: seeded,
          updatedAt: new Date().toISOString()
        });
        runtime.setRuntimeMode("mongo");
        return seeded;
      }

      runtime.setRuntimeMode("mongo");
      return runtime.normalizeModuleSettingsSnapshot(document.settings, normalizedFallback);
    } catch (error) {
      if (!runtime.allowMemoryFallback || runtime.forceMongo) {
        throw runtime.createPersistenceError(
          "REFERENCE_STATE_PERSISTENCE_INIT_FAILED",
          "Failed initializing reference-state persistence",
          error
        );
      }

      runtime.setRuntimeMode("memory-fallback");
      const nextMemorySnapshot = runtime.normalizeModuleSettingsSnapshot(
        runtime.getMemorySnapshot() ?? normalizedFallback,
        normalizedFallback
      );
      runtime.setMemorySnapshot(nextMemorySnapshot);
      runtime.recordMongoUnavailable(error, "module-settings-read");
      return runtime.normalizeModuleSettingsSnapshot(nextMemorySnapshot, normalizedFallback);
    }
  };
}

function createSaveModuleSettingsSnapshot(runtime) {
  return async function saveModuleSettingsSnapshot(snapshot) {
    const normalizedSnapshot = runtime.normalizeModuleSettingsSnapshot(snapshot, snapshot);
    const runtimeMode = runtime.getRuntimeMode();
    if (!runtime.enabled || runtimeMode === "disabled") {
      runtime.setRuntimeMode("disabled");
      runtime.setMemorySnapshot(
        runtime.normalizeModuleSettingsSnapshot(normalizedSnapshot, normalizedSnapshot)
      );
      return {
        ok: true,
        mode: runtime.getRuntimeMode(),
        persisted: false
      };
    }

    if (runtimeMode === "memory" || runtimeMode === "memory-fallback") {
      runtime.setMemorySnapshot(
        runtime.normalizeModuleSettingsSnapshot(normalizedSnapshot, normalizedSnapshot)
      );
      return {
        ok: true,
        mode: runtime.getRuntimeMode(),
        persisted: true
      };
    }

    try {
      const targetCollection = await runtime.ensureMongoCollection();
      await targetCollection.updateOne(
        {
          _id: runtime.moduleSettingsDocumentId
        },
        {
          $set: {
            settings: normalizedSnapshot,
            updatedAt: new Date().toISOString()
          }
        },
        {
          upsert: true
        }
      );

      return {
        ok: true,
        mode: runtime.getRuntimeMode(),
        persisted: true
      };
    } catch (error) {
      throw runtime.createPersistenceError(
        "REFERENCE_STATE_PERSISTENCE_FAILED",
        "Failed persisting reference-state snapshot",
        error
      );
    }
  };
}

function createModuleSettingsSnapshotRuntime(runtime) {
  return {
    readModuleSettingsSnapshot: createReadModuleSettingsSnapshot(runtime),
    saveModuleSettingsSnapshot: createSaveModuleSettingsSnapshot(runtime)
  };
}

export { createModuleSettingsSnapshotRuntime };
