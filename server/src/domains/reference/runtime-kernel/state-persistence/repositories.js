import {
  applyRemotesDeploySnapshotToState,
  applySnapshotToState,
  buildJobsSnapshotFromRuntime,
  buildRemotesDeploySnapshotFromState,
  buildSnapshotFromState,
  createJobsStateFromSnapshot,
  createRecordsNotesStateFromSnapshot,
  createRemotesDeployStateFromSnapshot,
  normalizeJobsSnapshot,
  normalizeModuleSettingsSnapshot
} from "./snapshot-helpers.js";

function normalizePolicyMode(value, fallback = "unknown") {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : fallback;
}

function describeReferenceStateRepositoryPolicy(referenceStatePersistence) {
  const persistenceSummary =
    typeof referenceStatePersistence?.describe === "function"
      ? referenceStatePersistence.describe()
      : null;
  const runtimeModeFromMethod =
    typeof referenceStatePersistence?.mode === "function"
      ? referenceStatePersistence.mode()
      : null;
  const configuredMode = normalizePolicyMode(
    persistenceSummary?.configuredMode,
    normalizePolicyMode(runtimeModeFromMethod)
  );
  const runtimeMode = normalizePolicyMode(
    persistenceSummary?.runtimeMode,
    configuredMode
  );

  return {
    configuredMode,
    runtimeMode,
    source: "reference-state-persistence",
    stateFilePath: null
  };
}

export function createRecordsNotesRepository({
  state,
  referenceStatePersistence
}) {
  if (!state || typeof state !== "object") {
    throw new Error("state is required for records-notes repository");
  }
  if (!referenceStatePersistence || typeof referenceStatePersistence !== "object") {
    throw new Error("referenceStatePersistence is required for records-notes repository");
  }

  const hasReadWriteSnapshotMethods =
    typeof referenceStatePersistence.readRecordsNotesSnapshot === "function" &&
    typeof referenceStatePersistence.saveRecordsNotesSnapshot === "function";
  const hasLegacyPersistMethod =
    typeof referenceStatePersistence.persistRecordsNotesState === "function";

  let writeQueue = Promise.resolve();

  async function readState() {
    if (hasReadWriteSnapshotMethods) {
      const fallbackSnapshot = buildSnapshotFromState(state);
      const snapshot =
        await referenceStatePersistence.readRecordsNotesSnapshot(fallbackSnapshot);
      applySnapshotToState(state, snapshot);
      return createRecordsNotesStateFromSnapshot(snapshot);
    }

    const snapshot = buildSnapshotFromState(state);
    return createRecordsNotesStateFromSnapshot(snapshot);
  }

  async function transact(mutator) {
    const run = async () => {
      const workingState = await readState();
      const outcome = await mutator(workingState);
      const shouldCommit = outcome?.commit === true;

      if (shouldCommit) {
        const snapshot = buildSnapshotFromState(workingState);
        if (hasReadWriteSnapshotMethods) {
          await referenceStatePersistence.saveRecordsNotesSnapshot(snapshot);
          applySnapshotToState(state, snapshot);
        } else {
          applySnapshotToState(state, snapshot);
          if (hasLegacyPersistMethod) {
            await referenceStatePersistence.persistRecordsNotesState(state);
          }
        }
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
      return describeReferenceStateRepositoryPolicy(referenceStatePersistence);
    }
  };
}

export function createRemotesDeployRepository({
  state,
  referenceStatePersistence
}) {
  if (!state || typeof state !== "object") {
    throw new Error("state is required for remotes-deploy repository");
  }
  if (!referenceStatePersistence || typeof referenceStatePersistence !== "object") {
    throw new Error("referenceStatePersistence is required for remotes-deploy repository");
  }

  const hasReadWriteSnapshotMethods =
    typeof referenceStatePersistence.readRemotesDeploySnapshot === "function" &&
    typeof referenceStatePersistence.saveRemotesDeploySnapshot === "function";
  const hasLegacyPersistMethod =
    typeof referenceStatePersistence.persistRemotesDeployState === "function";

  let writeQueue = Promise.resolve();

  async function readState() {
    if (hasReadWriteSnapshotMethods) {
      const fallbackSnapshot = buildRemotesDeploySnapshotFromState(state);
      const snapshot =
        await referenceStatePersistence.readRemotesDeploySnapshot(fallbackSnapshot);
      applyRemotesDeploySnapshotToState(state, snapshot);
      return createRemotesDeployStateFromSnapshot(snapshot);
    }

    const snapshot = buildRemotesDeploySnapshotFromState(state);
    return createRemotesDeployStateFromSnapshot(snapshot);
  }

  async function transact(mutator) {
    const run = async () => {
      const workingState = await readState();
      const outcome = await mutator(workingState);
      const shouldCommit = outcome?.commit === true;

      if (shouldCommit) {
        const snapshot = buildRemotesDeploySnapshotFromState(workingState);
        if (hasReadWriteSnapshotMethods) {
          await referenceStatePersistence.saveRemotesDeploySnapshot(snapshot);
          applyRemotesDeploySnapshotToState(state, snapshot);
        } else {
          applyRemotesDeploySnapshotToState(state, snapshot);
          if (hasLegacyPersistMethod) {
            await referenceStatePersistence.persistRemotesDeployState(state);
          }
        }
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
      return describeReferenceStateRepositoryPolicy(referenceStatePersistence);
    }
  };
}

export function createJobsRepository({ referenceStatePersistence }) {
  if (!referenceStatePersistence || typeof referenceStatePersistence !== "object") {
    throw new Error("referenceStatePersistence is required for jobs repository");
  }

  const hasReadWriteSnapshotMethods =
    typeof referenceStatePersistence.readJobsSnapshot === "function" &&
    typeof referenceStatePersistence.saveJobsSnapshot === "function";
  const hasLegacyPersistMethod =
    typeof referenceStatePersistence.persistJobsState === "function";

  const fallbackSnapshot = normalizeJobsSnapshot(
    {
      sequence: 0,
      jobs: [],
      logs: []
    },
    {
      sequence: 0,
      jobs: [],
      logs: []
    },
    {
      recoverInterruptedJobs: false
    }
  );

  let writeQueue = Promise.resolve();
  let memorySnapshot = fallbackSnapshot;

  async function readState() {
    if (hasReadWriteSnapshotMethods) {
      const snapshot =
        await referenceStatePersistence.readJobsSnapshot(memorySnapshot);
      memorySnapshot = normalizeJobsSnapshot(snapshot, memorySnapshot, {
        recoverInterruptedJobs: true
      });
      return createJobsStateFromSnapshot(memorySnapshot);
    }

    return createJobsStateFromSnapshot(memorySnapshot);
  }

  async function transact(mutator) {
    const run = async () => {
      const workingState = await readState();
      const outcome = await mutator(workingState);
      const shouldCommit = outcome?.commit === true;

      if (shouldCommit) {
        const snapshot = buildJobsSnapshotFromRuntime(workingState);
        if (hasReadWriteSnapshotMethods) {
          await referenceStatePersistence.saveJobsSnapshot(snapshot);
          memorySnapshot = normalizeJobsSnapshot(snapshot, memorySnapshot, {
            recoverInterruptedJobs: false
          });
        } else {
          memorySnapshot = normalizeJobsSnapshot(snapshot, memorySnapshot, {
            recoverInterruptedJobs: false
          });
          if (hasLegacyPersistMethod) {
            await referenceStatePersistence.persistJobsState(memorySnapshot);
          }
        }
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
      return describeReferenceStateRepositoryPolicy(referenceStatePersistence);
    }
  };
}

export function createModuleSettingsRepository({ referenceStatePersistence }) {
  if (!referenceStatePersistence || typeof referenceStatePersistence !== "object") {
    throw new Error("referenceStatePersistence is required for module settings repository");
  }

  const hasReadWriteSnapshotMethods =
    typeof referenceStatePersistence.readModuleSettingsSnapshot === "function" &&
    typeof referenceStatePersistence.saveModuleSettingsSnapshot === "function";

  let writeQueue = Promise.resolve();
  let memorySnapshot = {};

  async function readState() {
    if (!hasReadWriteSnapshotMethods) {
      return normalizeModuleSettingsSnapshot(memorySnapshot, {});
    }

    const snapshot = await referenceStatePersistence.readModuleSettingsSnapshot(
      memorySnapshot
    );
    memorySnapshot = normalizeModuleSettingsSnapshot(snapshot, memorySnapshot);
    return normalizeModuleSettingsSnapshot(memorySnapshot, {});
  }

  async function transact(mutator) {
    const run = async () => {
      const workingState = await readState();
      const outcome = await mutator(workingState);
      const shouldCommit = outcome?.commit === true;

      if (shouldCommit) {
        const normalizedSnapshot = normalizeModuleSettingsSnapshot(
          workingState,
          memorySnapshot
        );
        if (hasReadWriteSnapshotMethods) {
          await referenceStatePersistence.saveModuleSettingsSnapshot(normalizedSnapshot);
        }
        memorySnapshot = normalizedSnapshot;
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
      return describeReferenceStateRepositoryPolicy(referenceStatePersistence);
    }
  };
}
