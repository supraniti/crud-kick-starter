function createReadRemotesDeploySnapshot(runtime) {
  return async function readRemotesDeploySnapshot(fallbackStateSnapshot) {
    const fallbackSnapshot = runtime.normalizeRemotesDeploySnapshot(
      fallbackStateSnapshot,
      fallbackStateSnapshot
    );
    const runtimeMode = runtime.getRuntimeMode();

    if (!runtime.enabled || runtimeMode === "disabled") {
      runtime.setRuntimeMode("disabled");
      return runtime.normalizeRemotesDeploySnapshot(
        runtime.getMemorySnapshot() ?? fallbackSnapshot,
        fallbackSnapshot
      );
    }

    if (runtimeMode === "memory" || runtimeMode === "memory-fallback") {
      const nextMemorySnapshot = runtime.normalizeRemotesDeploySnapshot(
        runtime.getMemorySnapshot() ?? fallbackSnapshot,
        fallbackSnapshot
      );
      runtime.setMemorySnapshot(nextMemorySnapshot);
      return runtime.normalizeRemotesDeploySnapshot(nextMemorySnapshot, fallbackSnapshot);
    }

    try {
      const targetCollection = await runtime.ensureMongoCollection();
      const document = await targetCollection.findOne({
        _id: runtime.remotesDeployDocumentId
      });

      if (!document) {
        const seeded = runtime.normalizeRemotesDeploySnapshot(
          fallbackSnapshot,
          fallbackSnapshot
        );
        await targetCollection.insertOne({
          _id: runtime.remotesDeployDocumentId,
          ...seeded,
          updatedAt: new Date().toISOString()
        });
        runtime.setRuntimeMode("mongo");
        return seeded;
      }

      runtime.setRuntimeMode("mongo");
      return runtime.normalizeRemotesDeploySnapshot(document, fallbackSnapshot);
    } catch (error) {
      if (!runtime.allowMemoryFallback || runtime.forceMongo) {
        throw runtime.createPersistenceError(
          "REFERENCE_STATE_PERSISTENCE_INIT_FAILED",
          "Failed initializing reference-state persistence",
          error
        );
      }

      runtime.setRuntimeMode("memory-fallback");
      const nextMemorySnapshot = runtime.normalizeRemotesDeploySnapshot(
        runtime.getMemorySnapshot() ?? fallbackSnapshot,
        fallbackSnapshot
      );
      runtime.setMemorySnapshot(nextMemorySnapshot);
      runtime.recordMongoUnavailable(error, "remotes-deploy-read");
      return runtime.normalizeRemotesDeploySnapshot(nextMemorySnapshot, fallbackSnapshot);
    }
  };
}

function createSaveRemotesDeploySnapshot(runtime) {
  return async function saveRemotesDeploySnapshot(snapshot) {
    const normalizedSnapshot = runtime.normalizeRemotesDeploySnapshot(snapshot, snapshot);
    const runtimeMode = runtime.getRuntimeMode();
    if (!runtime.enabled || runtimeMode === "disabled") {
      runtime.setRuntimeMode("disabled");
      runtime.setMemorySnapshot(
        runtime.normalizeRemotesDeploySnapshot(normalizedSnapshot, normalizedSnapshot)
      );
      return {
        ok: true,
        mode: runtime.getRuntimeMode(),
        persisted: false
      };
    }

    if (runtimeMode === "memory" || runtimeMode === "memory-fallback") {
      runtime.setMemorySnapshot(
        runtime.normalizeRemotesDeploySnapshot(normalizedSnapshot, normalizedSnapshot)
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
          _id: runtime.remotesDeployDocumentId
        },
        {
          $set: {
            ...normalizedSnapshot,
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

function createRemotesDeploySnapshotRuntime(runtime) {
  return {
    readRemotesDeploySnapshot: createReadRemotesDeploySnapshot(runtime),
    saveRemotesDeploySnapshot: createSaveRemotesDeploySnapshot(runtime)
  };
}

export { createRemotesDeploySnapshotRuntime };
