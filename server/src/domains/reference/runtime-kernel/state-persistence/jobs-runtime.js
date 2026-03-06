function normalizeSnapshotForRead(normalizeJobsSnapshot, snapshot, fallbackSnapshot) {
  return normalizeJobsSnapshot(snapshot, fallbackSnapshot, {
    recoverInterruptedJobs: true
  });
}

function normalizeSnapshotForWrite(normalizeJobsSnapshot, snapshot) {
  return normalizeJobsSnapshot(snapshot, snapshot, {
    recoverInterruptedJobs: false
  });
}

function readSnapshotFromMemoryRuntime({
  normalizeJobsSnapshot,
  fallbackSnapshot,
  getMemorySnapshot,
  setMemorySnapshot,
  runtimeMode
}) {
  const nextMemorySnapshot = normalizeSnapshotForRead(
    normalizeJobsSnapshot,
    getMemorySnapshot() ?? fallbackSnapshot,
    fallbackSnapshot
  );
  if (runtimeMode === "memory" || runtimeMode === "memory-fallback") {
    setMemorySnapshot(nextMemorySnapshot);
  }

  return normalizeSnapshotForRead(normalizeJobsSnapshot, nextMemorySnapshot, fallbackSnapshot);
}

async function readSnapshotFromMongoRuntime({
  ensureMongoCollection,
  jobsDocumentId,
  normalizeJobsSnapshot,
  fallbackSnapshot,
  setRuntimeMode
}) {
  const targetCollection = await ensureMongoCollection();
  const document = await targetCollection.findOne({
    _id: jobsDocumentId
  });

  if (!document) {
    const seeded = normalizeJobsSnapshot(fallbackSnapshot, fallbackSnapshot, {
      recoverInterruptedJobs: false
    });
    await targetCollection.insertOne({
      _id: jobsDocumentId,
      ...seeded,
      updatedAt: new Date().toISOString()
    });
    setRuntimeMode("mongo");
    return normalizeSnapshotForRead(normalizeJobsSnapshot, seeded, fallbackSnapshot);
  }

  setRuntimeMode("mongo");
  return normalizeSnapshotForRead(normalizeJobsSnapshot, document, fallbackSnapshot);
}

function saveSnapshotToMemoryRuntime({
  enabled,
  runtimeMode,
  normalizedSnapshot,
  setRuntimeMode,
  setMemorySnapshot,
  normalizeJobsSnapshot
}) {
  if (!enabled || runtimeMode === "disabled") {
    setRuntimeMode("disabled");
    setMemorySnapshot(normalizeSnapshotForWrite(normalizeJobsSnapshot, normalizedSnapshot));
    return {
      ok: true,
      mode: "disabled",
      persisted: false
    };
  }

  if (runtimeMode === "memory" || runtimeMode === "memory-fallback") {
    setMemorySnapshot(normalizeSnapshotForWrite(normalizeJobsSnapshot, normalizedSnapshot));
    return {
      ok: true,
      mode: runtimeMode,
      persisted: true
    };
  }

  return null;
}

async function saveSnapshotToMongoRuntime({
  ensureMongoCollection,
  jobsDocumentId,
  normalizedSnapshot,
  getRuntimeMode
}) {
  const targetCollection = await ensureMongoCollection();
  await targetCollection.updateOne(
    {
      _id: jobsDocumentId
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
}

function createJobsSnapshotRuntime({
  enabled,
  allowMemoryFallback,
  forceMongo,
  jobsDocumentId,
  ensureMongoCollection,
  createPersistenceError,
  normalizeJobsSnapshot,
  recordMongoUnavailable,
  getRuntimeMode,
  setRuntimeMode,
  getMemorySnapshot,
  setMemorySnapshot
}) {
  async function readJobsSnapshot(fallbackStateSnapshot) {
    const fallbackSnapshot = normalizeSnapshotForRead(
      normalizeJobsSnapshot,
      fallbackStateSnapshot,
      fallbackStateSnapshot
    );
    const runtimeMode = getRuntimeMode();

    if (!enabled || runtimeMode === "disabled" || runtimeMode === "memory" || runtimeMode === "memory-fallback") {
      if (!enabled || runtimeMode === "disabled") {
        setRuntimeMode("disabled");
      }
      return readSnapshotFromMemoryRuntime({
        normalizeJobsSnapshot,
        fallbackSnapshot,
        getMemorySnapshot,
        setMemorySnapshot,
        runtimeMode
      });
    }

    try {
      return await readSnapshotFromMongoRuntime({
        ensureMongoCollection,
        jobsDocumentId,
        normalizeJobsSnapshot,
        fallbackSnapshot,
        setRuntimeMode
      });
    } catch (error) {
      if (!allowMemoryFallback || forceMongo) {
        throw createPersistenceError(
          "REFERENCE_STATE_PERSISTENCE_INIT_FAILED",
          "Failed initializing reference-state persistence",
          error
        );
      }

      setRuntimeMode("memory-fallback");
      const nextSnapshot = readSnapshotFromMemoryRuntime({
        normalizeJobsSnapshot,
        fallbackSnapshot,
        getMemorySnapshot,
        setMemorySnapshot,
        runtimeMode: "memory-fallback"
      });
      recordMongoUnavailable(error, "jobs-read");
      return normalizeSnapshotForRead(normalizeJobsSnapshot, nextSnapshot, fallbackSnapshot);
    }
  }

  async function saveJobsSnapshot(snapshot) {
    const normalizedSnapshot = normalizeSnapshotForWrite(normalizeJobsSnapshot, snapshot);
    const runtimeMode = getRuntimeMode();
    const memoryResult = saveSnapshotToMemoryRuntime({
      enabled,
      runtimeMode,
      normalizedSnapshot,
      setRuntimeMode,
      setMemorySnapshot,
      normalizeJobsSnapshot
    });
    if (memoryResult) {
      return memoryResult;
    }

    try {
      return await saveSnapshotToMongoRuntime({
        ensureMongoCollection,
        jobsDocumentId,
        normalizedSnapshot,
        getRuntimeMode
      });
    } catch (error) {
      throw createPersistenceError(
        "REFERENCE_STATE_PERSISTENCE_FAILED",
        "Failed persisting reference-state snapshot",
        error
      );
    }
  }

  return {
    readJobsSnapshot,
    saveJobsSnapshot
  };
}

export { createJobsSnapshotRuntime };
