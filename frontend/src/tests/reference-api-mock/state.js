import {
  CATEGORIES,
  COLLECTIONS,
  COLLECTION_SCHEMAS,
  MODULES,
  NOTES,
  PRODUCTS,
  RECORDS,
  REMOTES,
  TAGS
} from "../reference-fixtures.js";
import {
  resolveReferenceQueryKeys,
  resolveReferenceTitleKeys,
  resolveReferenceTitlesKeys
} from "../../runtime/shared-capability-bridges/reference-field-key-utils.mjs";

function resolveRouteViewForModule(moduleId) {
  if (moduleId === "products") {
    return { kind: "products" };
  }
  if (moduleId === "records") {
    return { kind: "collections" };
  }
  if (moduleId === "taxonomies") {
    return { kind: "taxonomies" };
  }
  if (moduleId === "remotes") {
    return { kind: "remotes" };
  }
  if (moduleId === "missions") {
    return { kind: "missions" };
  }
  return null;
}

function resolveQueryValueByKeys(query, keys = []) {
  if (!query || typeof query !== "object") {
    return undefined;
  }

  for (const key of keys) {
    if (
      typeof key === "string" &&
      key.length > 0 &&
      Object.prototype.hasOwnProperty.call(query, key) &&
      query[key] !== undefined
    ) {
      return query[key];
    }
  }

  return undefined;
}

function createRuntimeModuleItem(item) {
  const routeView = resolveRouteViewForModule(item.id);
  return {
    id: item.id,
    name: `${item.label} Module`,
    version: "0.1.0",
    capabilities:
      item.id === "products" || item.id === "records" || item.id === "taxonomies"
        ? ["ui.route", "schema", "crud.collection"]
        : item.id === "remotes"
          ? ["ui.route", "settings", "deploy.remote", "service", "mission"]
          : item.id === "missions"
            ? ["ui.route", "mission.operator"]
            : ["ui.route"],
    state: "enabled",
    ui: {
      navigation: {
        label: item.label,
        icon: item.icon
      },
      ...(routeView ? { routeView } : {})
    },
    collectionIds: item.id === "records" ? ["records", "notes"] : []
  };
}

function createModuleRuntime() {
  return MODULES.map((item) => createRuntimeModuleItem(item));
}

function createModuleSettingsDefinitions() {
  return {
    remotes: {
      moduleId: "remotes",
      fields: [
        {
          id: "deployMode",
          label: "Deploy Mode",
          type: "enum",
          required: true,
          options: [
            { value: "safe", label: "Safe" },
            { value: "fast", label: "Fast" }
          ],
          defaultValue: "safe",
          sensitive: false,
          description: "Controls the default deploy behavior profile."
        },
        {
          id: "deployTimeoutMs",
          label: "Deploy Timeout (ms)",
          type: "number",
          required: true,
          min: 1000,
          max: 600000,
          defaultValue: 120000,
          sensitive: false,
          description: "Maximum runtime for remote deployment operations."
        },
        {
          id: "verifyTls",
          label: "Verify TLS",
          type: "boolean",
          required: true,
          defaultValue: true,
          sensitive: false,
          description: "Enforce TLS certificate verification for remote endpoints."
        },
        {
          id: "controlPlaneUrl",
          label: "Control Plane URL",
          type: "url",
          required: false,
          defaultValue: "https://control.example.invalid/deploy",
          sensitive: false,
          description: "Optional control plane endpoint used for remote deployment orchestration."
        },
        {
          id: "lastAuditOn",
          label: "Last Audit On",
          type: "date",
          required: false,
          defaultValue: "2026-02-01",
          sensitive: false,
          description: "Optional last successful remote configuration audit date."
        },
        {
          id: "apiToken",
          label: "API Token",
          type: "text",
          required: false,
          defaultValue: null,
          sensitive: true,
          description: "Sensitive token used for authenticated remote deploy requests."
        }
      ]
    }
  };
}

function cloneCollectionSchemas() {
  return Object.fromEntries(
    Object.entries(COLLECTION_SCHEMAS).map(([collectionId, schema]) => [
      collectionId,
      {
        ...schema,
        fields: (schema.fields ?? []).map((field) => ({ ...field }))
      }
    ])
  );
}

function cloneModuleSettingsDefinitions(moduleSettingsDefinitions) {
  return Object.fromEntries(
    Object.entries(moduleSettingsDefinitions).map(([moduleId, definition]) => [
      moduleId,
      {
        ...definition,
        fields: (definition.fields ?? []).map((field) => ({
          ...field,
          options: Array.isArray(field.options) ? field.options.map((option) => ({ ...option })) : []
        }))
      }
    ])
  );
}

function createModuleSettingsValues() {
  return {
    remotes: {
      deployMode: "safe",
      deployTimeoutMs: 120000,
      verifyTls: true,
      controlPlaneUrl: "https://control.example.invalid/deploy",
      lastAuditOn: "2026-02-01",
      apiToken: "seed-token"
    }
  };
}

function createReleaseState() {
  return {
    currentRevision: 0,
    deployedRevision: 0,
    deployRequired: false,
    lastMutationAt: null,
    lastDeployAt: null,
    lastDeployJobId: null,
    lastDeployRemoteId: null
  };
}

export function cloneState() {
  const moduleRuntime = createModuleRuntime();
  const moduleSettingsDefinitions = createModuleSettingsDefinitions();

  return {
    modules: MODULES.map((item) => ({ ...item })),
    moduleRuntime,
    categories: CATEGORIES.map((item) => ({ ...item })),
    products: PRODUCTS.map((item) => ({ ...item, tagIds: [...item.tagIds] })),
    tags: TAGS.map((item) => ({ ...item })),
    records: RECORDS.map((item) => ({ ...item, noteIds: [...(item.noteIds ?? [])] })),
    notes: NOTES.map((item) => ({ ...item, labels: [...(item.labels ?? [])] })),
    remotes: REMOTES.map((item) => ({ ...item })),
    collections: COLLECTIONS.map((item) => ({ ...item })),
    collectionSchemas: cloneCollectionSchemas(),
    moduleSettingsDefinitions: cloneModuleSettingsDefinitions(moduleSettingsDefinitions),
    moduleSettingsValues: createModuleSettingsValues(),
    nextTagNumber: TAGS.length + 1,
    nextRecordNumber: RECORDS.length + 1,
    nextNoteNumber: NOTES.length + 1,
    nextRemoteNumber: REMOTES.length + 1,
    nextJobNumber: 1,
    nextMissionJobNumber: 1,
    jobs: [],
    missionJobs: [],
    release: createReleaseState()
  };
}

export function slugifyTitle(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function toId(prefix, number) {
  return `${prefix}-${String(number).padStart(3, "0")}`;
}

export function markDeployRequired(state) {
  state.release.currentRevision += 1;
  state.release.deployRequired = state.release.currentRevision > state.release.deployedRevision;
  state.release.lastMutationAt = "2026-02-11T00:10:00.000Z";
}

export function toDeployState(state) {
  return {
    ...state.release
  };
}

export function uniqueIds(values) {
  return [...new Set(values.filter(Boolean))];
}

function tagUsageCount(state, tagId) {
  return state.products.reduce((count, product) => {
    return count + (product.tagIds.includes(tagId) ? 1 : 0);
  }, 0);
}

export function resolveTags(state) {
  return state.tags.map((tag) => ({
    ...tag,
    usageCount: tagUsageCount(state, tag.id)
  }));
}

export function resolveProducts(state, filter = {}) {
  const requestedCategoryIds = Array.isArray(filter.categoryIds)
    ? filter.categoryIds.filter(Boolean)
    : [];
  const categoryMap = new Map(state.categories.map((item) => [item.id, item.label]));
  const tagMap = new Map(state.tags.map((item) => [item.id, item.label]));

  const filtered = state.products.filter((item) => {
    if (requestedCategoryIds.length === 0) {
      return true;
    }

    return requestedCategoryIds.includes(item.categoryId);
  });

  return filtered.map((item) => ({
    ...item,
    tagIds: [...item.tagIds],
    categoryLabel: categoryMap.get(item.categoryId) ?? item.categoryLabel ?? item.categoryId,
    tagLabels: item.tagIds.map((tagId) => tagMap.get(tagId) ?? tagId)
  }));
}

export function resolveRecords(state) {
  const noteMap = new Map(state.notes.map((item) => [item.id, item.title]));
  return state.records.map((item) => {
    const noteIds = [...(item.noteIds ?? [])];
    const resolvedTitles = noteIds.map((noteId) => noteMap.get(noteId) ?? noteId);
    const titleMap = {};
    for (const titlesKey of resolveReferenceTitlesKeys("noteIds")) {
      titleMap[titlesKey] = [...resolvedTitles];
    }

    return {
      ...item,
      noteIds,
      ...titleMap
    };
  });
}

export function resolveNotes(state) {
  const recordMap = new Map(state.records.map((item) => [item.id, item.title]));
  return state.notes.map((item) => {
    const recordTitle = item.recordId ? recordMap.get(item.recordId) ?? null : null;
    const titleMap = {};
    for (const titleKey of resolveReferenceTitleKeys("recordId")) {
      titleMap[titleKey] = recordTitle;
    }

    return {
      ...item,
      labels: [...(item.labels ?? [])],
      ...titleMap
    };
  });
}

export function findRecord(state, recordId) {
  return state.records.find((item) => item.id === recordId) ?? null;
}

export function findNote(state, noteId) {
  return state.notes.find((item) => item.id === noteId) ?? null;
}

export function findRemote(state, remoteId) {
  return state.remotes.find((item) => item.id === remoteId) ?? null;
}

export function hasRecordTitleConflict(state, title, excludeId = null) {
  const normalized = title.trim().toLowerCase();
  return state.records.some((item) => {
    if (excludeId && item.id === excludeId) {
      return false;
    }

    return item.title.trim().toLowerCase() === normalized;
  });
}

export function hasNoteTitleConflict(state, title, excludeId = null) {
  const normalized = title.trim().toLowerCase();
  return state.notes.some((item) => {
    if (excludeId && item.id === excludeId) {
      return false;
    }

    return item.title.trim().toLowerCase() === normalized;
  });
}

export function hasRemoteLabelConflict(state, label, excludeId = null) {
  const normalized = label.trim().toLowerCase();
  return state.remotes.some((item) => {
    if (excludeId && item.id === excludeId) {
      return false;
    }

    return item.label.trim().toLowerCase() === normalized;
  });
}

export function ensureRecordCrossField(item) {
  if (item.status === "published" && !item.publishedOn) {
    return {
      ok: false,
      error: {
        code: "RECORD_PUBLISHED_ON_REQUIRED_FOR_PUBLISHED",
        message: "Record publishedOn is required when status is published"
      }
    };
  }

  return { ok: true };
}

export function ensureNoteCrossField(item) {
  if ((item.labels ?? []).includes("release") && !item.dueDate) {
    return {
      ok: false,
      error: {
        code: "NOTE_DUE_DATE_REQUIRED_FOR_RELEASE",
        message: "Note dueDate is required when labels include 'release'"
      }
    };
  }

  return { ok: true };
}

export function ensureRecordReferences(state, noteIds) {
  if (!Array.isArray(noteIds)) {
    return {
      ok: false,
      error: {
        code: "RECORD_NOTE_IDS_INVALID",
        message: "Record noteIds must be an array"
      }
    };
  }

  for (const noteId of noteIds) {
    if (!findNote(state, noteId)) {
      return {
        ok: false,
        error: {
          code: "RECORD_NOTE_ID_NOT_FOUND",
          message: `Record note '${noteId}' was not found`
        }
      };
    }
  }

  return { ok: true };
}

export function ensureNoteReference(state, recordId) {
  if (recordId === null || recordId === "" || recordId === undefined) {
    return { ok: true };
  }

  if (!findRecord(state, recordId)) {
    return {
      ok: false,
      error: {
        code: "NOTE_RECORD_NOT_FOUND",
        message: `Record '${recordId}' was not found`
      }
    };
  }

  return { ok: true };
}

export function buildRecordList(state, query = {}) {
  const search = typeof query.search === "string" ? query.search.trim().toLowerCase() : "";
  const status = typeof query.status === "string" ? query.status.trim() : "";
  const noteIdRawValue = resolveQueryValueByKeys(
    query,
    resolveReferenceQueryKeys("noteIds", {
      multi: true
    })
  );
  const noteId = typeof noteIdRawValue === "string" ? noteIdRawValue.trim() : "";
  const offset = Number.parseInt(`${query.offset ?? 0}`, 10) || 0;
  const limit = Number.parseInt(`${query.limit ?? 25}`, 10) || 25;

  const filtered = resolveRecords(state).filter((item) => {
    if (search && !item.title.toLowerCase().includes(search)) {
      return false;
    }
    if (status && item.status !== status) {
      return false;
    }
    if (noteId && !(item.noteIds ?? []).includes(noteId)) {
      return false;
    }

    return true;
  });

  return {
    items: filtered.slice(offset, offset + limit),
    meta: {
      total: filtered.length,
      offset,
      limit
    },
    filters: {
      search,
      status,
      noteId
    }
  };
}

export function buildNoteList(state, query = {}) {
  const search = typeof query.search === "string" ? query.search.trim().toLowerCase() : "";
  const category = typeof query.category === "string" ? query.category.trim() : "";
  const labels = Array.isArray(query.labels) ? query.labels.filter(Boolean) : [];
  const recordIdRawValue = resolveQueryValueByKeys(query, resolveReferenceQueryKeys("recordId"));
  const recordId = typeof recordIdRawValue === "string" ? recordIdRawValue.trim() : "";
  const offset = Number.parseInt(`${query.offset ?? 0}`, 10) || 0;
  const limit = Number.parseInt(`${query.limit ?? 25}`, 10) || 25;

  const filtered = resolveNotes(state).filter((item) => {
    if (search && !item.title.toLowerCase().includes(search)) {
      return false;
    }
    if (category && item.category !== category) {
      return false;
    }
    if (labels.length > 0) {
      const itemLabels = item.labels ?? [];
      if (!labels.every((label) => itemLabels.includes(label))) {
        return false;
      }
    }
    if (recordId && item.recordId !== recordId) {
      return false;
    }

    return true;
  });

  return {
    items: filtered.slice(offset, offset + limit),
    meta: {
      total: filtered.length,
      offset,
      limit
    },
    filters: {
      search,
      category,
      labels,
      recordId
    }
  };
}

export function normalizeRecordPayload(payload) {
  return {
    title: `${payload.title ?? ""}`,
    status: payload.status ?? "draft",
    score: Number.parseInt(`${payload.score ?? 0}`, 10),
    featured: payload.featured === true,
    publishedOn: payload.publishedOn ?? null,
    noteIds: uniqueIds(Array.isArray(payload.noteIds) ? payload.noteIds : [])
  };
}

export function normalizeNotePayload(payload) {
  return {
    title: `${payload.title ?? ""}`,
    category: payload.category ?? "general",
    labels: uniqueIds(Array.isArray(payload.labels) ? payload.labels : []),
    priority: Number.parseInt(`${payload.priority ?? 3}`, 10),
    pinned: payload.pinned === true,
    dueDate: payload.dueDate ?? null,
    recordId: payload.recordId ?? null
  };
}

export function resolveActiveCollectionIds(state) {
  const activeCollectionIds = new Set();
  for (const module of state.moduleRuntime) {
    if (module.state !== "enabled") {
      continue;
    }

    for (const collectionId of module.collectionIds ?? []) {
      if (collectionId) {
        activeCollectionIds.add(collectionId);
      }
    }
  }

  return [...activeCollectionIds];
}

export function isCollectionActive(state, collectionId) {
  return resolveActiveCollectionIds(state).includes(collectionId);
}

