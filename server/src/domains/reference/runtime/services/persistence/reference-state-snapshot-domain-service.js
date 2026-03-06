const VALID_PERSISTENCE_MODES = new Set(["auto", "mongo", "memory"]);
const TRUE_LITERALS = new Set(["1", "true", "yes", "on"]);
const FALSE_LITERALS = new Set(["0", "false", "no", "off"]);
const DEFAULT_RELEASE_STATE = Object.freeze({
  currentRevision: 0,
  deployedRevision: 0,
  deployRequired: false,
  lastMutationAt: null,
  lastDeployAt: null,
  lastDeployJobId: null,
  lastDeployRemoteId: null
});
const DEFAULT_JOB_CREATED_AT = "1970-01-01T00:00:00.000Z";
const VALID_JOB_STATUSES = new Set([
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled"
]);

function cloneValue(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== "object") {
    return value;
  }

  try {
    return structuredClone(value);
  } catch {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return null;
    }
  }
}

function parseJobSequence(jobId) {
  if (typeof jobId !== "string") {
    return 0;
  }

  const match = /^job-(\d+)$/.exec(jobId);
  if (!match) {
    return 0;
  }

  const sequence = Number.parseInt(match[1], 10);
  return Number.isFinite(sequence) && sequence >= 0 ? sequence : 0;
}

function normalizePersistenceMode(value, fallback = "auto") {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return VALID_PERSISTENCE_MODES.has(normalized) ? normalized : fallback;
}

function parseBooleanLiteral(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (value === 1) {
      return true;
    }

    if (value === 0) {
      return false;
    }

    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (TRUE_LITERALS.has(normalized)) {
    return true;
  }
  if (FALSE_LITERALS.has(normalized)) {
    return false;
  }

  return null;
}

function resolveBooleanSetting(optionValue, envValue, fallback) {
  const fromOption = parseBooleanLiteral(optionValue);
  if (fromOption !== null) {
    return fromOption;
  }

  const fromEnv = parseBooleanLiteral(envValue);
  if (fromEnv !== null) {
    return fromEnv;
  }

  return fallback;
}

function toPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(`${value ?? ""}`, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeJobStatus(status) {
  if (status === "succeeded") {
    return "completed";
  }

  return VALID_JOB_STATUSES.has(status) ? status : "failed";
}

function normalizeJobError(error, fallback = null) {
  if (!error || typeof error !== "object") {
    return fallback;
  }

  return {
    code:
      typeof error.code === "string" && error.code.length > 0
        ? error.code
        : "ASYNC_JOB_HANDLER_ERROR",
    message:
      typeof error.message === "string" && error.message.length > 0
        ? error.message
        : "Async job handler failed"
  };
}

function normalizeJobEntries(rawJobs, fallbackJobs = [], options = {}) {
  const sourceJobs = Array.isArray(rawJobs) ? rawJobs : fallbackJobs;
  const nowIso = typeof options.nowIso === "string" ? options.nowIso : new Date().toISOString();
  const recoverInterruptedJobs = options.recoverInterruptedJobs === true;

  return sourceJobs
    .map((rawJob) => {
      if (!rawJob || typeof rawJob !== "object") {
        return null;
      }

      const id = typeof rawJob.id === "string" ? rawJob.id : "";
      const type = typeof rawJob.type === "string" ? rawJob.type : "";
      if (id.length === 0 || type.length === 0) {
        return null;
      }

      let status = normalizeJobStatus(rawJob.status);
      let finishedAt = typeof rawJob.finishedAt === "string" ? rawJob.finishedAt : null;
      let error = normalizeJobError(rawJob.error, null);

      if (recoverInterruptedJobs && (status === "queued" || status === "running")) {
        status = "failed";
        finishedAt = finishedAt ?? nowIso;
        error = error ?? {
          code: "ASYNC_JOB_RECOVERED_ON_STARTUP",
          message: "Job could not resume after runtime restart"
        };
      }

      return {
        id,
        type,
        status,
        createdAt:
          typeof rawJob.createdAt === "string" ? rawJob.createdAt : DEFAULT_JOB_CREATED_AT,
        startedAt: typeof rawJob.startedAt === "string" ? rawJob.startedAt : null,
        finishedAt,
        payload:
          rawJob.payload &&
          typeof rawJob.payload === "object" &&
          !Array.isArray(rawJob.payload)
            ? cloneValue(rawJob.payload)
            : {},
        result: rawJob.result === undefined ? null : cloneValue(rawJob.result),
        error
      };
    })
    .filter(Boolean);
}

function normalizeJobLogEntries(rawEntries, fallbackEntries = []) {
  const sourceEntries = Array.isArray(rawEntries) ? rawEntries : fallbackEntries;

  return sourceEntries
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      return {
        timestamp:
          typeof entry.timestamp === "string"
            ? entry.timestamp
            : new Date().toISOString(),
        level:
          typeof entry.level === "string" && entry.level.length > 0 ? entry.level : "info",
        message:
          typeof entry.message === "string" ? entry.message : "Job runtime log entry",
        context:
          entry.context && typeof entry.context === "object" && !Array.isArray(entry.context)
            ? cloneValue(entry.context)
            : {}
      };
    })
    .filter(Boolean);
}

function normalizeJobLogs(rawLogs, fallbackLogs = []) {
  const entries = [];
  const source =
    Array.isArray(rawLogs) || (rawLogs && typeof rawLogs === "object")
      ? rawLogs
      : fallbackLogs;

  if (Array.isArray(source)) {
    for (const item of source) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const jobId = typeof item.jobId === "string" ? item.jobId : "";
      if (jobId.length === 0) {
        continue;
      }

      entries.push({
        jobId,
        entries: normalizeJobLogEntries(item.entries, [])
      });
    }
  } else {
    for (const [jobId, logs] of Object.entries(source)) {
      if (typeof jobId !== "string" || jobId.length === 0) {
        continue;
      }

      entries.push({
        jobId,
        entries: normalizeJobLogEntries(logs, [])
      });
    }
  }

  return entries;
}

function buildJobsSnapshotFromRuntime(snapshot) {
  const fallback = {
    sequence: 0,
    jobs: [],
    logs: []
  };

  const normalized = normalizeJobsSnapshot(snapshot, fallback, {
    recoverInterruptedJobs: false
  });

  return {
    sequence: normalized.sequence,
    jobs: normalizeJobEntries(normalized.jobs, []),
    logs: normalizeJobLogs(normalized.logs, [])
  };
}

function normalizeJobsSnapshot(rawSnapshot, fallbackSnapshot, options = {}) {
  const fallback = {
    sequence: Number.isInteger(fallbackSnapshot?.sequence)
      ? fallbackSnapshot.sequence
      : 0,
    jobs: normalizeJobEntries(fallbackSnapshot?.jobs, [], {
      recoverInterruptedJobs: false
    }),
    logs: normalizeJobLogs(fallbackSnapshot?.logs, [])
  };

  const jobs = normalizeJobEntries(rawSnapshot?.jobs, fallback.jobs, options);
  const maxFromJobs = jobs.reduce((max, job) => Math.max(max, parseJobSequence(job.id)), 0);
  const sequenceCandidate =
    Number.isInteger(rawSnapshot?.sequence) && rawSnapshot.sequence >= 0
      ? rawSnapshot.sequence
      : fallback.sequence;

  return {
    sequence: Math.max(sequenceCandidate, maxFromJobs),
    jobs,
    logs: normalizeJobLogs(rawSnapshot?.logs, fallback.logs)
  };
}

function createJobsStateFromSnapshot(snapshot) {
  return {
    sequence: Number.isInteger(snapshot.sequence) ? snapshot.sequence : 0,
    jobs: normalizeJobEntries(snapshot.jobs, [], {
      recoverInterruptedJobs: false
    }),
    logs: normalizeJobLogs(snapshot.logs, [])
  };
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function normalizeModuleSettingsValueMap(rawValueMap, fallbackValueMap = {}) {
  const source = isPlainObject(rawValueMap) ? rawValueMap : fallbackValueMap;
  const normalized = {};

  for (const [fieldId, value] of Object.entries(source)) {
    if (typeof fieldId !== "string" || fieldId.length === 0) {
      continue;
    }
    normalized[fieldId] = cloneValue(value);
  }

  return normalized;
}

function normalizeModuleSettingsSnapshot(rawSnapshot, fallbackSnapshot = {}) {
  const fallback =
    isPlainObject(fallbackSnapshot) && Object.keys(fallbackSnapshot).length > 0
      ? fallbackSnapshot
      : {};
  const source = isPlainObject(rawSnapshot) ? rawSnapshot : fallback;
  const normalized = {};

  for (const [moduleId, rawValueMap] of Object.entries(source)) {
    if (typeof moduleId !== "string" || moduleId.length === 0) {
      continue;
    }
    normalized[moduleId] = normalizeModuleSettingsValueMap(rawValueMap, {});
  }

  for (const [moduleId, fallbackValueMap] of Object.entries(fallback)) {
    if (!Object.prototype.hasOwnProperty.call(normalized, moduleId)) {
      normalized[moduleId] = normalizeModuleSettingsValueMap(fallbackValueMap, {});
    }
  }

  return normalized;
}

function cloneRecords(records = []) {
  return records.map((row) => ({
    ...row,
    noteIds: Array.isArray(row.noteIds) ? [...row.noteIds] : []
  }));
}

function cloneNotes(notes = []) {
  return notes.map((row) => ({
    ...row,
    labels: Array.isArray(row.labels) ? [...row.labels] : []
  }));
}

function cloneRemotes(remotes = []) {
  return remotes.map((row) => ({
    ...row
  }));
}

function cloneCategories(categories = []) {
  return categories.map((row) => ({
    ...row
  }));
}

function cloneTags(tags = []) {
  return tags.map((row) => ({
    ...row
  }));
}

function cloneProducts(products = []) {
  return products.map((row) => ({
    ...row,
    tagIds: Array.isArray(row.tagIds) ? [...row.tagIds] : []
  }));
}

function toNonNegativeIntegerOrFallback(value, fallback) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function normalizeNullableString(value, fallback = null) {
  if (value === null) {
    return null;
  }

  return typeof value === "string" ? value : fallback;
}

function normalizeReleaseState(release, fallbackRelease = DEFAULT_RELEASE_STATE) {
  const fallback = {
    ...DEFAULT_RELEASE_STATE,
    ...(fallbackRelease ?? {})
  };

  return {
    currentRevision: toNonNegativeIntegerOrFallback(
      release?.currentRevision,
      fallback.currentRevision
    ),
    deployedRevision: toNonNegativeIntegerOrFallback(
      release?.deployedRevision,
      fallback.deployedRevision
    ),
    deployRequired:
      typeof release?.deployRequired === "boolean"
        ? release.deployRequired
        : fallback.deployRequired,
    lastMutationAt: normalizeNullableString(
      release?.lastMutationAt,
      fallback.lastMutationAt
    ),
    lastDeployAt: normalizeNullableString(
      release?.lastDeployAt,
      fallback.lastDeployAt
    ),
    lastDeployJobId: normalizeNullableString(
      release?.lastDeployJobId,
      fallback.lastDeployJobId
    ),
    lastDeployRemoteId: normalizeNullableString(
      release?.lastDeployRemoteId,
      fallback.lastDeployRemoteId
    )
  };
}

function toPositiveIntegerOrFallback(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function buildSnapshotFromState(state) {
  return {
    records: cloneRecords(state.records),
    notes: cloneNotes(state.notes),
    nextRecordNumber: toPositiveIntegerOrFallback(state.nextRecordNumber, 1),
    nextNoteNumber: toPositiveIntegerOrFallback(state.nextNoteNumber, 1)
  };
}

function applySnapshotToState(state, snapshot) {
  state.records = cloneRecords(snapshot.records);
  state.notes = cloneNotes(snapshot.notes);
  state.nextRecordNumber = snapshot.nextRecordNumber;
  state.nextNoteNumber = snapshot.nextNoteNumber;
}

function normalizeSnapshot(rawSnapshot, fallbackStateSnapshot) {
  const records = Array.isArray(rawSnapshot?.records)
    ? cloneRecords(rawSnapshot.records)
    : cloneRecords(fallbackStateSnapshot.records);
  const notes = Array.isArray(rawSnapshot?.notes)
    ? cloneNotes(rawSnapshot.notes)
    : cloneNotes(fallbackStateSnapshot.notes);

  return {
    records,
    notes,
    nextRecordNumber: toPositiveIntegerOrFallback(
      rawSnapshot?.nextRecordNumber,
      fallbackStateSnapshot.nextRecordNumber
    ),
    nextNoteNumber: toPositiveIntegerOrFallback(
      rawSnapshot?.nextNoteNumber,
      fallbackStateSnapshot.nextNoteNumber
    )
  };
}

function createRecordsNotesStateFromSnapshot(snapshot) {
  return {
    records: cloneRecords(snapshot.records),
    notes: cloneNotes(snapshot.notes),
    nextRecordNumber: snapshot.nextRecordNumber,
    nextNoteNumber: snapshot.nextNoteNumber
  };
}

function buildRemotesDeploySnapshotFromState(state) {
  const fallbackRelease = normalizeReleaseState(state.release, DEFAULT_RELEASE_STATE);

  return {
    categories: cloneCategories(state.categories),
    tags: cloneTags(state.tags),
    products: cloneProducts(state.products),
    remotes: cloneRemotes(state.remotes),
    release: fallbackRelease,
    nextTagNumber: toPositiveIntegerOrFallback(state.nextTagNumber, 1),
    nextRemoteNumber: toPositiveIntegerOrFallback(state.nextRemoteNumber, 1)
  };
}

function applyRemotesDeploySnapshotToState(state, snapshot) {
  state.categories = cloneCategories(snapshot.categories);
  state.tags = cloneTags(snapshot.tags);
  state.products = cloneProducts(snapshot.products);
  state.remotes = cloneRemotes(snapshot.remotes);
  state.release = normalizeReleaseState(snapshot.release, state.release ?? {});
  state.nextTagNumber = snapshot.nextTagNumber;
  state.nextRemoteNumber = snapshot.nextRemoteNumber;
}

function normalizeRemotesDeploySnapshot(rawSnapshot, fallbackStateSnapshot) {
  const categories = Array.isArray(rawSnapshot?.categories)
    ? cloneCategories(rawSnapshot.categories)
    : cloneCategories(fallbackStateSnapshot.categories);
  const tags = Array.isArray(rawSnapshot?.tags)
    ? cloneTags(rawSnapshot.tags)
    : cloneTags(fallbackStateSnapshot.tags);
  const products = Array.isArray(rawSnapshot?.products)
    ? cloneProducts(rawSnapshot.products)
    : cloneProducts(fallbackStateSnapshot.products);
  const remotes = Array.isArray(rawSnapshot?.remotes)
    ? cloneRemotes(rawSnapshot.remotes)
    : cloneRemotes(fallbackStateSnapshot.remotes);

  return {
    categories,
    tags,
    products,
    remotes,
    release: normalizeReleaseState(
      rawSnapshot?.release,
      fallbackStateSnapshot.release
    ),
    nextTagNumber: toPositiveIntegerOrFallback(
      rawSnapshot?.nextTagNumber,
      fallbackStateSnapshot.nextTagNumber
    ),
    nextRemoteNumber: toPositiveIntegerOrFallback(
      rawSnapshot?.nextRemoteNumber,
      fallbackStateSnapshot.nextRemoteNumber
    )
  };
}

function createRemotesDeployStateFromSnapshot(snapshot) {
  return {
    categories: cloneCategories(snapshot.categories),
    tags: cloneTags(snapshot.tags),
    products: cloneProducts(snapshot.products),
    remotes: cloneRemotes(snapshot.remotes),
    release: normalizeReleaseState(snapshot.release, snapshot.release),
    nextTagNumber: snapshot.nextTagNumber,
    nextRemoteNumber: snapshot.nextRemoteNumber
  };
}


export {
  applyRemotesDeploySnapshotToState,
  applySnapshotToState,
  buildJobsSnapshotFromRuntime,
  buildRemotesDeploySnapshotFromState,
  buildSnapshotFromState,
  createJobsStateFromSnapshot,
  createRecordsNotesStateFromSnapshot,
  createRemotesDeployStateFromSnapshot,
  normalizeJobsSnapshot,
  normalizeModuleSettingsSnapshot,
  normalizePersistenceMode,
  normalizeRemotesDeploySnapshot,
  normalizeSnapshot,
  resolveBooleanSetting,
  toPositiveInteger
};
