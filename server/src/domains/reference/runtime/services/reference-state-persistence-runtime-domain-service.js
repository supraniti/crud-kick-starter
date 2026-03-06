import { MongoClient } from "mongodb";
import {
  applyRemotesDeploySnapshotToState,
  applySnapshotToState,
  buildJobsSnapshotFromRuntime,
  buildRemotesDeploySnapshotFromState,
  buildSnapshotFromState,
  normalizeJobsSnapshot,
  normalizeModuleSettingsSnapshot,
  normalizePersistenceMode,
  normalizeRemotesDeploySnapshot,
  normalizeSnapshot,
  resolveBooleanSetting,
  toPositiveInteger
} from "../../runtime-kernel/state-persistence/snapshot-helpers.js";
import { createModuleSettingsSnapshotRuntime } from "../../runtime-kernel/state-persistence/module-settings-runtime.js";
import { createRecordsNotesSnapshotRuntime } from "../../runtime-kernel/state-persistence/records-notes-runtime.js";
import { createRemotesDeploySnapshotRuntime } from "../../runtime-kernel/state-persistence/remotes-deploy-runtime.js";
import { createJobsSnapshotRuntime } from "../../runtime-kernel/state-persistence/jobs-runtime.js";
export {
  createJobsRepository,
  createModuleSettingsRepository,
  createRecordsNotesRepository,
  createRemotesDeployRepository
} from "../../runtime-kernel/state-persistence/repositories.js";

const DEFAULT_RECORDS_NOTES_DOCUMENT_ID = "records-notes";
const DEFAULT_REMOTES_DEPLOY_DOCUMENT_ID = "remotes-deploy";
const DEFAULT_JOBS_DOCUMENT_ID = "jobs-runtime";
const DEFAULT_MODULE_SETTINGS_DOCUMENT_ID = "module-settings";
const DEFAULT_COLLECTION_NAME = "reference_runtime_state";
const DEFAULT_MODE = "auto";
const DEFAULT_MONGO_SERVER_SELECTION_TIMEOUT_MS = 2000;

function createPersistenceError(code, message, cause) {
  const error = new Error(message);
  error.code = code;
  if (cause) {
    error.cause = cause;
  }

  return error;
}

function detectDatabaseNameFromUri(uri) {
  if (typeof uri !== "string" || uri.length === 0) {
    return "admin";
  }

  const match = uri.match(/\/([^/?]+)(\?|$)/);
  if (!match) {
    return "admin";
  }

  const name = match[1]?.trim();
  return name && name.length > 0 ? decodeURIComponent(name) : "admin";
}

function resolvePersistenceAdapterConfig(options) {
  const mode = normalizePersistenceMode(
    options.mode ?? process.env.REFERENCE_STATE_MODE,
    DEFAULT_MODE
  );
  const enabled = resolveBooleanSetting(
    options.enabled,
    process.env.REFERENCE_STATE_PERSISTENCE_ENABLED,
    process.env.NODE_ENV !== "test"
  );
  const allowMemoryFallback = resolveBooleanSetting(
    options.allowMemoryFallback,
    process.env.REFERENCE_STATE_ALLOW_MEMORY_FALLBACK,
    process.env.NODE_ENV === "test"
  );
  const mongoServerSelectionTimeoutMs = toPositiveInteger(
    options.serverSelectionTimeoutMs ??
      process.env.REFERENCE_STATE_MONGO_SERVER_SELECTION_TIMEOUT_MS,
    DEFAULT_MONGO_SERVER_SELECTION_TIMEOUT_MS
  );
  const mongoUri = options.mongoUri ?? "";
  const databaseName =
    options.databaseName ??
    process.env.REFERENCE_STATE_DB ??
    detectDatabaseNameFromUri(mongoUri);
  const collectionName = options.collectionName ?? DEFAULT_COLLECTION_NAME;
  const recordsNotesDocumentId =
    options.recordsNotesDocumentId ??
    options.documentId ??
    DEFAULT_RECORDS_NOTES_DOCUMENT_ID;
  const remotesDeployDocumentId =
    options.remotesDeployDocumentId ?? DEFAULT_REMOTES_DEPLOY_DOCUMENT_ID;
  const jobsDocumentId = options.jobsDocumentId ?? DEFAULT_JOBS_DOCUMENT_ID;
  const moduleSettingsDocumentId =
    options.moduleSettingsDocumentId ?? DEFAULT_MODULE_SETTINGS_DOCUMENT_ID;
  const forceMemory = mode === "memory";
  const forceMongo = mode === "mongo";
  return {
    mode,
    enabled,
    allowMemoryFallback,
    mongoServerSelectionTimeoutMs,
    mongoUri,
    databaseName,
    collectionName,
    recordsNotesDocumentId,
    remotesDeployDocumentId,
    jobsDocumentId,
    moduleSettingsDocumentId,
    forceMemory,
    forceMongo
  };
}

function createPersistenceRuntimeState(config) {
  return {
    diagnostics: [],
    runtimeMode: config.enabled
      ? config.forceMemory
        ? "memory"
        : "mongo"
      : "disabled",
    memoryRecordsNotesSnapshot: null,
    memoryRemotesDeploySnapshot: null,
    memoryJobsSnapshot: null,
    memoryModuleSettingsSnapshot: null,
    client: null,
    collection: null
  };
}

function createMongoUnavailableRecorder(runtimeState) {
  return (error, phase) => {
    const nextDiagnostic = {
      code: "REFERENCE_STATE_MONGO_UNAVAILABLE",
      message:
        "Mongo persistence unavailable; running in degraded memory fallback mode (non-durable)",
      phase,
      runtimeMode: "memory-fallback",
      allowMemoryFallback: true,
      errorMessage: error?.message ?? "Unknown Mongo initialization failure"
    };
    const duplicate = runtimeState.diagnostics.some(
      (item) =>
        item.code === nextDiagnostic.code &&
        item.phase === nextDiagnostic.phase &&
        item.errorMessage === nextDiagnostic.errorMessage
    );
    if (!duplicate) {
      runtimeState.diagnostics.push(nextDiagnostic);
    }
  };
}

function createMongoCollectionResolver(config, runtimeState) {
  return async function ensureMongoCollection() {
    if (runtimeState.collection) {
      return runtimeState.collection;
    }

    if (typeof config.mongoUri !== "string" || config.mongoUri.trim().length === 0) {
      throw createPersistenceError(
        "REFERENCE_STATE_MONGO_URI_MISSING",
        "Mongo URI is missing for reference-state persistence"
      );
    }

    runtimeState.client = new MongoClient(config.mongoUri, {
      serverSelectionTimeoutMS: config.mongoServerSelectionTimeoutMs
    });
    await runtimeState.client.connect();
    runtimeState.collection = runtimeState.client
      .db(config.databaseName)
      .collection(config.collectionName);
    return runtimeState.collection;
  };
}

function createRuntimeModeBridge(runtimeState) {
  return {
    getRuntimeMode: () => runtimeState.runtimeMode,
    setRuntimeMode: (nextRuntimeMode) => {
      runtimeState.runtimeMode = nextRuntimeMode;
    }
  };
}

function createSnapshotRuntimes(config, runtimeState, ensureMongoCollection, recordMongoUnavailable) {
  const runtimeModeBridge = createRuntimeModeBridge(runtimeState);
  const recordsNotesSnapshotRuntime = createRecordsNotesSnapshotRuntime({
    enabled: config.enabled,
    allowMemoryFallback: config.allowMemoryFallback,
    forceMongo: config.forceMongo,
    recordsNotesDocumentId: config.recordsNotesDocumentId,
    ensureMongoCollection,
    createPersistenceError,
    normalizeSnapshot,
    recordMongoUnavailable,
    ...runtimeModeBridge,
    getMemorySnapshot: () => runtimeState.memoryRecordsNotesSnapshot,
    setMemorySnapshot: (nextSnapshot) => {
      runtimeState.memoryRecordsNotesSnapshot = nextSnapshot;
    }
  });
  const remotesDeploySnapshotRuntime = createRemotesDeploySnapshotRuntime({
    enabled: config.enabled,
    allowMemoryFallback: config.allowMemoryFallback,
    forceMongo: config.forceMongo,
    remotesDeployDocumentId: config.remotesDeployDocumentId,
    ensureMongoCollection,
    createPersistenceError,
    normalizeRemotesDeploySnapshot,
    recordMongoUnavailable,
    ...runtimeModeBridge,
    getMemorySnapshot: () => runtimeState.memoryRemotesDeploySnapshot,
    setMemorySnapshot: (nextSnapshot) => {
      runtimeState.memoryRemotesDeploySnapshot = nextSnapshot;
    }
  });
  const jobsSnapshotRuntime = createJobsSnapshotRuntime({
    enabled: config.enabled,
    allowMemoryFallback: config.allowMemoryFallback,
    forceMongo: config.forceMongo,
    jobsDocumentId: config.jobsDocumentId,
    ensureMongoCollection,
    createPersistenceError,
    normalizeJobsSnapshot,
    recordMongoUnavailable,
    ...runtimeModeBridge,
    getMemorySnapshot: () => runtimeState.memoryJobsSnapshot,
    setMemorySnapshot: (nextSnapshot) => {
      runtimeState.memoryJobsSnapshot = nextSnapshot;
    }
  });
  const moduleSettingsSnapshotRuntime = createModuleSettingsSnapshotRuntime({
    enabled: config.enabled,
    allowMemoryFallback: config.allowMemoryFallback,
    forceMongo: config.forceMongo,
    moduleSettingsDocumentId: config.moduleSettingsDocumentId,
    ensureMongoCollection,
    createPersistenceError,
    normalizeModuleSettingsSnapshot,
    recordMongoUnavailable,
    ...runtimeModeBridge,
    getMemorySnapshot: () => runtimeState.memoryModuleSettingsSnapshot,
    setMemorySnapshot: (nextSnapshot) => {
      runtimeState.memoryModuleSettingsSnapshot = nextSnapshot;
    }
  });
  return {
    ...recordsNotesSnapshotRuntime,
    ...remotesDeploySnapshotRuntime,
    ...jobsSnapshotRuntime,
    ...moduleSettingsSnapshotRuntime
  };
}

function toHydrationResult(runtimeState) {
  return {
    ok: true,
    mode: runtimeState.runtimeMode,
    diagnostics: [...runtimeState.diagnostics]
  };
}

async function closeMongoClient(runtimeState) {
  if (!runtimeState.client) {
    return;
  }
  try {
    await runtimeState.client.close();
  } finally {
    runtimeState.client = null;
    runtimeState.collection = null;
  }
}

function describePersistenceRuntime(config, runtimeState) {
  return {
    enabled: config.enabled,
    configuredMode: config.mode,
    runtimeMode: runtimeState.runtimeMode,
    allowMemoryFallback: config.allowMemoryFallback,
    failFast: config.enabled && !config.allowMemoryFallback,
    mongoUriConfigured:
      typeof config.mongoUri === "string" && config.mongoUri.trim().length > 0,
    mongoServerSelectionTimeoutMs: config.mongoServerSelectionTimeoutMs,
    databaseName: config.databaseName,
    collectionName: config.collectionName,
    moduleSettingsDocumentId: config.moduleSettingsDocumentId
  };
}

export function createReferenceStatePersistenceAdapter(options = {}) {
  const config = resolvePersistenceAdapterConfig(options);
  const runtimeState = createPersistenceRuntimeState(config);
  const recordMongoUnavailable = createMongoUnavailableRecorder(runtimeState);
  const ensureMongoCollection = createMongoCollectionResolver(config, runtimeState);
  const snapshotRuntimes = createSnapshotRuntimes(
    config,
    runtimeState,
    ensureMongoCollection,
    recordMongoUnavailable
  );

  async function hydrateState(state) {
    const fallbackSnapshot = buildSnapshotFromState(state);
    if (config.forceMemory && config.enabled) {
      runtimeState.runtimeMode = "memory";
    }
    const snapshot = await snapshotRuntimes.readRecordsNotesSnapshot(fallbackSnapshot);
    applySnapshotToState(state, snapshot);
    return toHydrationResult(runtimeState);
  }

  async function persistRecordsNotesState(state) {
    const snapshot = buildSnapshotFromState(state);
    return snapshotRuntimes.saveRecordsNotesSnapshot(snapshot);
  }

  async function hydrateRemotesDeployState(state) {
    const fallbackSnapshot = buildRemotesDeploySnapshotFromState(state);
    if (config.forceMemory && config.enabled) {
      runtimeState.runtimeMode = "memory";
    }
    const snapshot = await snapshotRuntimes.readRemotesDeploySnapshot(fallbackSnapshot);
    applyRemotesDeploySnapshotToState(state, snapshot);
    return toHydrationResult(runtimeState);
  }

  async function persistRemotesDeployState(state) {
    const snapshot = buildRemotesDeploySnapshotFromState(state);
    return snapshotRuntimes.saveRemotesDeploySnapshot(snapshot);
  }

  async function persistJobsState(snapshot) {
    const normalizedSnapshot = buildJobsSnapshotFromRuntime(snapshot);
    return snapshotRuntimes.saveJobsSnapshot(normalizedSnapshot);
  }

  async function close() {
    return closeMongoClient(runtimeState);
  }

  function describe() {
    return describePersistenceRuntime(config, runtimeState);
  }

  return {
    enabled: config.enabled,
    mode: () => runtimeState.runtimeMode,
    describe,
    diagnostics: runtimeState.diagnostics,
    hydrateState,
    hydrateRemotesDeployState,
    readRecordsNotesSnapshot: snapshotRuntimes.readRecordsNotesSnapshot,
    saveRecordsNotesSnapshot: snapshotRuntimes.saveRecordsNotesSnapshot,
    readRemotesDeploySnapshot: snapshotRuntimes.readRemotesDeploySnapshot,
    saveRemotesDeploySnapshot: snapshotRuntimes.saveRemotesDeploySnapshot,
    readJobsSnapshot: snapshotRuntimes.readJobsSnapshot,
    saveJobsSnapshot: snapshotRuntimes.saveJobsSnapshot,
    readModuleSettingsSnapshot: snapshotRuntimes.readModuleSettingsSnapshot,
    saveModuleSettingsSnapshot: snapshotRuntimes.saveModuleSettingsSnapshot,
    persistRecordsNotesState,
    persistRemotesDeployState,
    persistJobsState,
    close
  };
}

