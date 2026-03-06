function createRecordsNotesSnapshotRuntime({
  enabled,
  allowMemoryFallback,
  forceMongo,
  recordsNotesDocumentId,
  ensureMongoCollection,
  createPersistenceError,
  normalizeSnapshot,
  recordMongoUnavailable,
  getRuntimeMode,
  setRuntimeMode,
  getMemorySnapshot,
  setMemorySnapshot
}) {
  async function readRecordsNotesSnapshot(fallbackStateSnapshot) {
    const fallbackSnapshot = normalizeSnapshot(
      fallbackStateSnapshot,
      fallbackStateSnapshot
    );
    const runtimeMode = getRuntimeMode();

    if (!enabled || runtimeMode === "disabled") {
      setRuntimeMode("disabled");
      return normalizeSnapshot(getMemorySnapshot() ?? fallbackSnapshot, fallbackSnapshot);
    }

    if (runtimeMode === "memory" || runtimeMode === "memory-fallback") {
      const nextMemorySnapshot = normalizeSnapshot(
        getMemorySnapshot() ?? fallbackSnapshot,
        fallbackSnapshot
      );
      setMemorySnapshot(nextMemorySnapshot);
      return normalizeSnapshot(nextMemorySnapshot, fallbackSnapshot);
    }

    try {
      const targetCollection = await ensureMongoCollection();
      const document = await targetCollection.findOne({
        _id: recordsNotesDocumentId
      });

      if (!document) {
        const seeded = normalizeSnapshot(fallbackSnapshot, fallbackSnapshot);
        await targetCollection.insertOne({
          _id: recordsNotesDocumentId,
          ...seeded,
          updatedAt: new Date().toISOString()
        });
        setRuntimeMode("mongo");
        return seeded;
      }

      setRuntimeMode("mongo");
      return normalizeSnapshot(document, fallbackSnapshot);
    } catch (error) {
      if (!allowMemoryFallback || forceMongo) {
        throw createPersistenceError(
          "REFERENCE_STATE_PERSISTENCE_INIT_FAILED",
          "Failed initializing reference-state persistence",
          error
        );
      }

      setRuntimeMode("memory-fallback");
      const nextMemorySnapshot = normalizeSnapshot(
        getMemorySnapshot() ?? fallbackSnapshot,
        fallbackSnapshot
      );
      setMemorySnapshot(nextMemorySnapshot);
      recordMongoUnavailable(error, "records-notes-read");
      return normalizeSnapshot(nextMemorySnapshot, fallbackSnapshot);
    }
  }
  async function saveRecordsNotesSnapshot(snapshot) {
    const normalizedSnapshot = normalizeSnapshot(snapshot, snapshot);
    const runtimeMode = getRuntimeMode();
    if (!enabled || runtimeMode === "disabled") {
      setRuntimeMode("disabled");
      setMemorySnapshot(normalizeSnapshot(normalizedSnapshot, normalizedSnapshot));
      return {
        ok: true,
        mode: getRuntimeMode(),
        persisted: false
      };
    }

    if (runtimeMode === "memory" || runtimeMode === "memory-fallback") {
      setMemorySnapshot(normalizeSnapshot(normalizedSnapshot, normalizedSnapshot));
      return {
        ok: true,
        mode: getRuntimeMode(),
        persisted: true
      };
    }

    try {
      const targetCollection = await ensureMongoCollection();
      await targetCollection.updateOne(
        {
          _id: recordsNotesDocumentId
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
        mode: getRuntimeMode(),
        persisted: true
      };
    } catch (error) {
      throw createPersistenceError(
        "REFERENCE_STATE_PERSISTENCE_FAILED",
        "Failed persisting reference-state snapshot",
        error
      );
    }
  }

  return { readRecordsNotesSnapshot, saveRecordsNotesSnapshot };
}

export { createRecordsNotesSnapshotRuntime };
