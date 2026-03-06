import { spec } from "pactum";
import { buildServer } from "../../../src/app.js";
import {
  MODULE_ID_MODE_DUAL_COMPAT,
  MODULE_ID_MODE_NEW_ID_AUTHORITATIVE,
  resolveScenarioModuleIdBindings
} from "../../../../scripts/module-id-bindings.mjs";

const MODULE_ID_BINDINGS = resolveScenarioModuleIdBindings({
  mode: process.env.REFERENCE_MODULE_ID_TRANSLATION_MODE,
  mapPath: process.env.REFERENCE_MODULE_ID_TRANSLATION_MAP_FILE
});

function isNewIdAuthoritativeTranslationMode() {
  return MODULE_ID_BINDINGS.mode === MODULE_ID_MODE_NEW_ID_AUTHORITATIVE;
}

function isModulesNextDiscoveryRootActive() {
  return (
    typeof process.env.REFERENCE_MODULES_ROOT_DIR === "string" &&
    process.env.REFERENCE_MODULES_ROOT_DIR.trim() === "modules-next"
  );
}

function resolveReferenceLegacyModuleId(moduleId) {
  const normalized = typeof moduleId === "string" ? moduleId.trim() : "";
  if (normalized.length === 0) {
    return normalized;
  }
  return MODULE_ID_BINDINGS.moduleIds[normalized] ?? normalized;
}

function resolveReferenceTargetModuleId(moduleId) {
  const normalized = typeof moduleId === "string" ? moduleId.trim() : "";
  if (normalized.length === 0) {
    return normalized;
  }
  return MODULE_ID_BINDINGS.targetModuleIds[normalized] ?? resolveReferenceLegacyModuleId(normalized);
}

function shouldPreferReferenceTargetModuleIds() {
  if (isNewIdAuthoritativeTranslationMode()) {
    return true;
  }

  if (MODULE_ID_BINDINGS.mode === MODULE_ID_MODE_DUAL_COMPAT) {
    return true;
  }

  return isModulesNextDiscoveryRootActive();
}

function resolveReferenceModuleId(moduleId) {
  if (shouldPreferReferenceTargetModuleIds()) {
    return resolveReferenceTargetModuleId(moduleId);
  }

  return resolveReferenceLegacyModuleId(moduleId);
}

function resolveReferenceModuleRouteId(moduleId) {
  return resolveReferenceLegacyModuleId(moduleId);
}

function resolveReferenceModuleIdCandidates(moduleId) {
  const legacyId = typeof moduleId === "string" ? moduleId.trim() : "";
  const legacyResolvedId = resolveReferenceLegacyModuleId(legacyId);
  const targetResolvedId = resolveReferenceTargetModuleId(legacyId);
  if (legacyResolvedId.length === 0 && targetResolvedId.length === 0) {
    return [];
  }

  if (isNewIdAuthoritativeTranslationMode()) {
    return [targetResolvedId];
  }

  const candidates = [];
  if (legacyId.length > 0) {
    candidates.push(legacyId);
  }
  if (legacyResolvedId.length > 0) {
    candidates.push(legacyResolvedId);
  }
  if (targetResolvedId.length > 0) {
    candidates.push(targetResolvedId);
  }

  return [...new Set(candidates)];
}

function buildReferenceModuleLifecyclePath(moduleId, action) {
  const resolvedModuleId = resolveReferenceModuleRouteId(moduleId);
  const normalizedAction = typeof action === "string" ? action.trim() : "";
  return `/api/reference/modules/${resolvedModuleId}/${normalizedAction}`;
}

function buildReferenceModuleSettingsPath(moduleId) {
  return `/api/reference/settings/modules/${resolveReferenceModuleRouteId(moduleId)}`;
}

function resolveModuleSettingsSnapshotKey(moduleId) {
  return resolveReferenceModuleId(moduleId);
}

function createMockContainerManager() {
  return {
    async status() {
      return {
        ok: true,
        operation: "status",
        container: {
          id: "mongo",
          label: "MongoDB",
          dockerName: "crud-control-mongo",
          tags: ["database", "mongo"]
        },
        engine: {
          available: true
        },
        status: {
          exists: true,
          running: true,
          state: "running",
          statusText: "running"
        },
        timestamp: new Date().toISOString()
      };
    },
    async start() {
      return this.status();
    },
    async stop() {
      return this.status();
    },
    async restart() {
      return this.status();
    }
  };
}

function cloneRecordRows(records = []) {
  return records.map((row) => ({
    ...row,
    noteIds: Array.isArray(row.noteIds) ? [...row.noteIds] : []
  }));
}

function cloneNoteRows(notes = []) {
  return notes.map((row) => ({
    ...row,
    labels: Array.isArray(row.labels) ? [...row.labels] : []
  }));
}

function cloneRemoteRows(remotes = []) {
  return remotes.map((row) => ({
    ...row
  }));
}

function cloneCategoryRows(categories = []) {
  return categories.map((row) => ({
    ...row
  }));
}

function cloneTagRows(tags = []) {
  return tags.map((row) => ({
    ...row
  }));
}

function cloneProductRows(products = []) {
  return products.map((row) => ({
    ...row,
    tagIds: Array.isArray(row.tagIds) ? [...row.tagIds] : []
  }));
}

function cloneJsonValue(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== "object") {
    return value;
  }

  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function cloneJobRows(jobs = []) {
  return jobs.map((row) => ({
    id: row.id,
    type: row.type,
    status: row.status,
    createdAt: row.createdAt,
    startedAt: row.startedAt ?? null,
    finishedAt: row.finishedAt ?? null,
    payload: cloneJsonValue(row.payload ?? {}),
    result: cloneJsonValue(row.result ?? null),
    error: row.error
      ? {
          code: row.error.code,
          message: row.error.message
        }
      : null
  }));
}

function cloneJobLogRows(logs = []) {
  return logs.map((entry) => ({
    jobId: entry.jobId,
    entries: Array.isArray(entry.entries)
      ? entry.entries.map((logEntry) => ({
          timestamp: logEntry.timestamp,
          level: logEntry.level,
          message: logEntry.message,
          context: cloneJsonValue(logEntry.context ?? {})
        }))
      : []
  }));
}

function cloneReleaseState(release = {}) {
  return {
    currentRevision:
      Number.isInteger(release.currentRevision) && release.currentRevision >= 0
        ? release.currentRevision
        : 0,
    deployedRevision:
      Number.isInteger(release.deployedRevision) && release.deployedRevision >= 0
        ? release.deployedRevision
        : 0,
    deployRequired: release.deployRequired === true,
    lastMutationAt: typeof release.lastMutationAt === "string" ? release.lastMutationAt : null,
    lastDeployAt: typeof release.lastDeployAt === "string" ? release.lastDeployAt : null,
    lastDeployJobId: typeof release.lastDeployJobId === "string" ? release.lastDeployJobId : null,
    lastDeployRemoteId:
      typeof release.lastDeployRemoteId === "string" ? release.lastDeployRemoteId : null
  };
}

function createSharedReferenceStatePersistence(initialSnapshot = null) {
  const store = {
    recordsNotesSnapshot: initialSnapshot
      ? {
          records: cloneRecordRows(initialSnapshot.records),
          notes: cloneNoteRows(initialSnapshot.notes),
          nextRecordNumber: initialSnapshot.nextRecordNumber,
          nextNoteNumber: initialSnapshot.nextNoteNumber
        }
      : null,
    remotesDeploySnapshot: initialSnapshot
      ? {
          categories: cloneCategoryRows(initialSnapshot.categories),
          tags: cloneTagRows(initialSnapshot.tags),
          products: cloneProductRows(initialSnapshot.products),
          remotes: cloneRemoteRows(initialSnapshot.remotes),
          release: cloneReleaseState(initialSnapshot.release),
          nextTagNumber: initialSnapshot.nextTagNumber,
          nextRemoteNumber: initialSnapshot.nextRemoteNumber
        }
      : null,
    jobsSnapshot: initialSnapshot
      ? {
          sequence:
            Number.isInteger(initialSnapshot.sequence) && initialSnapshot.sequence >= 0
              ? initialSnapshot.sequence
              : 0,
          jobs: cloneJobRows(initialSnapshot.jobs),
          logs: cloneJobLogRows(initialSnapshot.logs)
        }
      : null,
    moduleSettingsSnapshot: initialSnapshot?.moduleSettings
      ? cloneJsonValue(initialSnapshot.moduleSettings)
      : null
  };

  return {
    store,
    adapter: {
      async hydrateState(state) {
        if (!store.recordsNotesSnapshot) {
          store.recordsNotesSnapshot = {
            records: cloneRecordRows(state.records),
            notes: cloneNoteRows(state.notes),
            nextRecordNumber: state.nextRecordNumber,
            nextNoteNumber: state.nextNoteNumber
          };
        }

        state.records = cloneRecordRows(store.recordsNotesSnapshot.records);
        state.notes = cloneNoteRows(store.recordsNotesSnapshot.notes);
        state.nextRecordNumber = store.recordsNotesSnapshot.nextRecordNumber;
        state.nextNoteNumber = store.recordsNotesSnapshot.nextNoteNumber;

        return {
          ok: true,
          mode: "memory-test",
          diagnostics: []
        };
      },
      async readRecordsNotesSnapshot(fallbackSnapshot) {
        if (!store.recordsNotesSnapshot) {
          store.recordsNotesSnapshot = {
            records: cloneRecordRows(fallbackSnapshot?.records),
            notes: cloneNoteRows(fallbackSnapshot?.notes),
            nextRecordNumber: fallbackSnapshot?.nextRecordNumber ?? 1,
            nextNoteNumber: fallbackSnapshot?.nextNoteNumber ?? 1
          };
        }

        return {
          records: cloneRecordRows(store.recordsNotesSnapshot.records),
          notes: cloneNoteRows(store.recordsNotesSnapshot.notes),
          nextRecordNumber: store.recordsNotesSnapshot.nextRecordNumber,
          nextNoteNumber: store.recordsNotesSnapshot.nextNoteNumber
        };
      },
      async saveRecordsNotesSnapshot(snapshot) {
        store.recordsNotesSnapshot = {
          records: cloneRecordRows(snapshot?.records),
          notes: cloneNoteRows(snapshot?.notes),
          nextRecordNumber: snapshot?.nextRecordNumber ?? 1,
          nextNoteNumber: snapshot?.nextNoteNumber ?? 1
        };

        return {
          ok: true,
          mode: "memory-test",
          persisted: true
        };
      },
      async persistRecordsNotesState(state) {
        store.recordsNotesSnapshot = {
          records: cloneRecordRows(state.records),
          notes: cloneNoteRows(state.notes),
          nextRecordNumber: state.nextRecordNumber,
          nextNoteNumber: state.nextNoteNumber
        };

        return {
          ok: true,
          mode: "memory-test",
          persisted: true
        };
      },
      async hydrateRemotesDeployState(state) {
        if (!store.remotesDeploySnapshot) {
          store.remotesDeploySnapshot = {
            categories: cloneCategoryRows(state.categories),
            tags: cloneTagRows(state.tags),
            products: cloneProductRows(state.products),
            remotes: cloneRemoteRows(state.remotes),
            release: cloneReleaseState(state.release),
            nextTagNumber: state.nextTagNumber,
            nextRemoteNumber: state.nextRemoteNumber
          };
        }

        state.categories = cloneCategoryRows(store.remotesDeploySnapshot.categories);
        state.tags = cloneTagRows(store.remotesDeploySnapshot.tags);
        state.products = cloneProductRows(store.remotesDeploySnapshot.products);
        state.remotes = cloneRemoteRows(store.remotesDeploySnapshot.remotes);
        state.release = cloneReleaseState(store.remotesDeploySnapshot.release);
        state.nextTagNumber = store.remotesDeploySnapshot.nextTagNumber;
        state.nextRemoteNumber = store.remotesDeploySnapshot.nextRemoteNumber;

        return {
          ok: true,
          mode: "memory-test",
          diagnostics: []
        };
      },
      async readRemotesDeploySnapshot(fallbackSnapshot) {
        if (!store.remotesDeploySnapshot) {
          store.remotesDeploySnapshot = {
            categories: cloneCategoryRows(fallbackSnapshot?.categories),
            tags: cloneTagRows(fallbackSnapshot?.tags),
            products: cloneProductRows(fallbackSnapshot?.products),
            remotes: cloneRemoteRows(fallbackSnapshot?.remotes),
            release: cloneReleaseState(fallbackSnapshot?.release),
            nextTagNumber: fallbackSnapshot?.nextTagNumber ?? 1,
            nextRemoteNumber: fallbackSnapshot?.nextRemoteNumber ?? 1
          };
        }

        return {
          categories: cloneCategoryRows(store.remotesDeploySnapshot.categories),
          tags: cloneTagRows(store.remotesDeploySnapshot.tags),
          products: cloneProductRows(store.remotesDeploySnapshot.products),
          remotes: cloneRemoteRows(store.remotesDeploySnapshot.remotes),
          release: cloneReleaseState(store.remotesDeploySnapshot.release),
          nextTagNumber: store.remotesDeploySnapshot.nextTagNumber,
          nextRemoteNumber: store.remotesDeploySnapshot.nextRemoteNumber
        };
      },
      async saveRemotesDeploySnapshot(snapshot) {
        store.remotesDeploySnapshot = {
          categories: cloneCategoryRows(snapshot?.categories),
          tags: cloneTagRows(snapshot?.tags),
          products: cloneProductRows(snapshot?.products),
          remotes: cloneRemoteRows(snapshot?.remotes),
          release: cloneReleaseState(snapshot?.release),
          nextTagNumber: snapshot?.nextTagNumber ?? 1,
          nextRemoteNumber: snapshot?.nextRemoteNumber ?? 1
        };

        return {
          ok: true,
          mode: "memory-test",
          persisted: true
        };
      },
      async persistRemotesDeployState(state) {
        store.remotesDeploySnapshot = {
          categories: cloneCategoryRows(state.categories),
          tags: cloneTagRows(state.tags),
          products: cloneProductRows(state.products),
          remotes: cloneRemoteRows(state.remotes),
          release: cloneReleaseState(state.release),
          nextTagNumber: state.nextTagNumber,
          nextRemoteNumber: state.nextRemoteNumber
        };

        return {
          ok: true,
          mode: "memory-test",
          persisted: true
        };
      },
      async readJobsSnapshot(fallbackSnapshot) {
        if (!store.jobsSnapshot) {
          store.jobsSnapshot = {
            sequence:
              Number.isInteger(fallbackSnapshot?.sequence) && fallbackSnapshot.sequence >= 0
                ? fallbackSnapshot.sequence
                : 0,
            jobs: cloneJobRows(fallbackSnapshot?.jobs),
            logs: cloneJobLogRows(fallbackSnapshot?.logs)
          };
        }

        return {
          sequence: store.jobsSnapshot.sequence,
          jobs: cloneJobRows(store.jobsSnapshot.jobs),
          logs: cloneJobLogRows(store.jobsSnapshot.logs)
        };
      },
      async saveJobsSnapshot(snapshot) {
        store.jobsSnapshot = {
          sequence:
            Number.isInteger(snapshot?.sequence) && snapshot.sequence >= 0
              ? snapshot.sequence
              : 0,
          jobs: cloneJobRows(snapshot?.jobs),
          logs: cloneJobLogRows(snapshot?.logs)
        };

        return {
          ok: true,
          mode: "memory-test",
          persisted: true
        };
      },
      async readModuleSettingsSnapshot(fallbackSnapshot) {
        if (!store.moduleSettingsSnapshot) {
          store.moduleSettingsSnapshot = cloneJsonValue(
            fallbackSnapshot && typeof fallbackSnapshot === "object"
              ? fallbackSnapshot
              : {}
          );
        }

        return cloneJsonValue(store.moduleSettingsSnapshot ?? {});
      },
      async saveModuleSettingsSnapshot(snapshot) {
        store.moduleSettingsSnapshot = cloneJsonValue(
          snapshot && typeof snapshot === "object" ? snapshot : {}
        );

        return {
          ok: true,
          mode: "memory-test",
          persisted: true
        };
      },
      async close() {
        // no-op
      }
    }
  };
}

function createRuntimeCollectionModuleManifest({
  moduleId = "widgets",
  moduleName = "Widgets Module",
  collectionId = "widgets",
  runtimeEntrypoint,
  persistenceEntrypoint
} = {}) {
  const runtime = {};
  if (runtimeEntrypoint) {
    runtime.collectionHandlers = runtimeEntrypoint;
  }
  if (persistenceEntrypoint) {
    runtime.persistence = persistenceEntrypoint;
  }

  return {
    contractVersion: 1,
    id: moduleId,
    version: "0.1.0",
    name: moduleName,
    capabilities: ["ui.route", "schema", "crud.collection"],
    lifecycle: {
      install: `${moduleId}.install`,
      uninstall: `${moduleId}.uninstall`
    },
    ...(Object.keys(runtime).length > 0 ? { runtime } : {}),
    collections: [
      {
        id: collectionId,
        label: "Widgets",
        primaryField: "title",
        description: "Widgets collection",
        capabilities: {
          list: true,
          read: true,
          create: true,
          update: true,
          delete: true
        },
        fields: [
          {
            id: "title",
            label: "Title",
            type: "text",
            required: true
          }
        ]
      }
    ]
  };
}

function createRuntimeServiceMissionModuleManifest({
  moduleId = "widgets-runtime",
  moduleName = "Widgets Runtime Module",
  runtimeServicesEntrypoint,
  runtimeMissionsEntrypoint
} = {}) {
  const runtime = {};
  if (runtimeServicesEntrypoint) {
    runtime.services = runtimeServicesEntrypoint;
  }
  if (runtimeMissionsEntrypoint) {
    runtime.missions = runtimeMissionsEntrypoint;
  }

  return {
    contractVersion: 1,
    id: moduleId,
    version: "0.1.0",
    name: moduleName,
    capabilities: ["ui.route", "service", "mission"],
    lifecycle: {
      install: `${moduleId}.install`,
      uninstall: `${moduleId}.uninstall`
    },
    ...(Object.keys(runtime).length > 0 ? { runtime } : {})
  };
}

function createModuleManifestWithoutCollections({
  moduleId = "records",
  moduleName = "Records Module",
  navigationLabel = "Records",
  navigationIcon = "dataset",
  navigationOrder = 20
} = {}) {
  return {
    contractVersion: 1,
    id: moduleId,
    version: "0.1.0",
    name: moduleName,
    capabilities: ["ui.route"],
    lifecycle: {
      install: `${moduleId}.install`,
      uninstall: `${moduleId}.uninstall`
    },
    ui: {
      navigation: {
        label: navigationLabel,
        icon: navigationIcon,
        order: navigationOrder
      }
    }
  };
}

async function createEphemeralReferenceServer(options = {}) {
  const instance = buildServer({
    logger: false,
    containerManager: createMockContainerManager(),
    moduleRuntimeStateFile: options.moduleRuntimeStateFile,
    modulesDir: options.modulesDir,
    referenceStatePersistence: options.referenceStatePersistence,
    moduleIdTranslationMapFile: options.moduleIdTranslationMapFile,
    moduleIdTranslationMode: options.moduleIdTranslationMode
  });

  await instance.listen({
    host: "127.0.0.1",
    port: 0
  });

  return instance;
}

async function injectJson(instance, method, url, payload) {
  const response = await instance.inject({
    method,
    url,
    payload
  });

  return {
    statusCode: response.statusCode,
    body: JSON.parse(response.body)
  };
}

async function waitForDeployJob(jobId, timeoutMs = 20_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const response = await spec()
      .get(`/api/reference/deploy/jobs/${jobId}`)
      .expectStatus(200);
    const status = response.body?.job?.status;
    if (status === "succeeded" || status === "failed" || status === "cancelled") {
      return response.body.job;
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error(`Timed out waiting for deploy job '${jobId}'`);
}

async function waitForDeployJobInInstance(instance, jobId, timeoutMs = 20_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const response = await injectJson(instance, "GET", `/api/reference/deploy/jobs/${jobId}`);
    if (response.statusCode === 200) {
      const status = response.body?.job?.status;
      if (status === "succeeded" || status === "failed" || status === "cancelled") {
        return response.body.job;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error(`Timed out waiting for deploy job '${jobId}'`);
}

async function waitForMissionJob(instance, jobId, timeoutMs = 20_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const response = await injectJson(instance, "GET", `/api/reference/missions/jobs/${jobId}`);
    if (response.statusCode === 200) {
      const status = response.body?.job?.status;
      if (status === "succeeded" || status === "failed" || status === "cancelled") {
        return response.body.job;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error(`Timed out waiting for mission job '${jobId}'`);
}
export {
  buildReferenceModuleLifecyclePath,
  buildReferenceModuleSettingsPath,
  createEphemeralReferenceServer,
  createMockContainerManager,
  createModuleManifestWithoutCollections,
  isNewIdAuthoritativeTranslationMode,
  createRuntimeCollectionModuleManifest,
  createRuntimeServiceMissionModuleManifest,
  createSharedReferenceStatePersistence,
  injectJson,
  resolveModuleSettingsSnapshotKey,
  resolveReferenceModuleId,
  resolveReferenceModuleRouteId,
  resolveReferenceModuleIdCandidates,
  waitForDeployJob,
  waitForDeployJobInInstance,
  waitForMissionJob
};

