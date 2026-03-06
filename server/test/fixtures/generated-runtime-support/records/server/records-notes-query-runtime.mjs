import {
  resolveReferenceQueryKeys,
  resolveReferenceTitleKeys,
  resolveReferenceTitlesKeys
} from "../shared/reference-field-key-utils.mjs";

const DEFAULT_RECORD_STATUSES = Object.freeze(["draft", "review", "published"]);
const DEFAULT_NOTE_CATEGORIES = Object.freeze(["general", "tech", "ops"]);
const DEFAULT_NOTE_LABELS = Object.freeze(["action", "ops", "ui", "backend", "release"]);

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

function parseCsvIds(rawValue) {
  if (typeof rawValue !== "string" || rawValue.length === 0) {
    return [];
  }

  return [...new Set(rawValue.split(",").map((value) => value.trim()).filter(Boolean))];
}

function parsePagination(value, fallback) {
  const parsed = Number.parseInt(`${value ?? ""}`, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function uniqueIds(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.length > 0))];
}

function normalizeQueryToken(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

function normalizeQueryReferenceId(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function resolveRecordQueryProfile(profile = null) {
  if (
    profile &&
    typeof profile === "object" &&
    profile.statusSet instanceof Set &&
    Array.isArray(profile.statuses)
  ) {
    return profile;
  }

  return {
    statuses: [...DEFAULT_RECORD_STATUSES],
    statusSet: new Set(DEFAULT_RECORD_STATUSES)
  };
}

function resolveNoteQueryProfile(profile = null) {
  if (
    profile &&
    typeof profile === "object" &&
    profile.categorySet instanceof Set &&
    profile.labelSet instanceof Set
  ) {
    return profile;
  }

  return {
    categories: [...DEFAULT_NOTE_CATEGORIES],
    labels: [...DEFAULT_NOTE_LABELS],
    categorySet: new Set(DEFAULT_NOTE_CATEGORIES),
    labelSet: new Set(DEFAULT_NOTE_LABELS)
  };
}

function resolveRecordRows(state) {
  return Array.isArray(state?.records) ? state.records : [];
}

function resolveNoteRows(state) {
  return Array.isArray(state?.notes) ? state.notes : [];
}

export function validateNoteCrossFieldConstraints(note) {
  if ((note?.labels ?? []).includes("release") && note?.dueDate === null) {
    return {
      code: "NOTE_DUE_DATE_REQUIRED_FOR_RELEASE",
      message: "Note dueDate is required when labels include 'release'"
    };
  }

  return null;
}

export function nextNoteId(state) {
  const id = `note-${String(state.nextNoteNumber).padStart(3, "0")}`;
  state.nextNoteNumber += 1;
  return id;
}

export function findRecordById(state, recordId) {
  return resolveRecordRows(state).find((row) => row.id === recordId) ?? null;
}

export function findNoteById(state, noteId) {
  return resolveNoteRows(state).find((row) => row.id === noteId) ?? null;
}

export function resolveRecordRow(row, state) {
  const noteIds = [...(row.noteIds ?? [])];
  const resolvedNoteTitles =
    state && noteIds.length > 0
      ? noteIds.map((noteId) => findNoteById(state, noteId)?.title ?? noteId)
      : [];
  const noteTitleMap = {};
  for (const titlesKey of resolveReferenceTitlesKeys("noteIds")) {
    noteTitleMap[titlesKey] = [...resolvedNoteTitles];
  }

  return {
    ...row,
    noteIds,
    ...noteTitleMap
  };
}

export function resolveNoteRow(row, state) {
  const record = row.recordId ? findRecordById(state, row.recordId) : null;
  const recordTitle = record?.title ?? null;
  const recordTitleMap = {};
  for (const titleKey of resolveReferenceTitleKeys("recordId")) {
    recordTitleMap[titlesKeyOrFallback(titleKey)] = recordTitle;
  }
  return {
    ...row,
    labels: [...(row.labels ?? [])],
    ...recordTitleMap
  };
}

function titlesKeyOrFallback(titleKey) {
  return typeof titleKey === "string" && titleKey.length > 0 ? titleKey : "recordIdTitle";
}

export function hasRecordTitleConflict(state, title, excludeId = null) {
  const normalized = `${title ?? ""}`.trim().toLowerCase();
  return resolveRecordRows(state).some((row) => {
    if (excludeId && row.id === excludeId) {
      return false;
    }

    return row.title.trim().toLowerCase() === normalized;
  });
}

export function hasNoteTitleConflict(state, title, excludeId = null) {
  const normalized = `${title ?? ""}`.trim().toLowerCase();
  return resolveNoteRows(state).some((row) => {
    if (excludeId && row.id === excludeId) {
      return false;
    }

    return row.title.trim().toLowerCase() === normalized;
  });
}

export function parseRecordQuery(query = {}, profile = null) {
  const recordProfile = resolveRecordQueryProfile(profile);
  const offset = parsePagination(query.offset, 0);
  const limit = Math.max(1, Math.min(parsePagination(query.limit, 25), 200));
  const search = typeof query.search === "string" ? query.search.trim().toLowerCase() : "";
  const status = normalizeQueryToken(query.status);
  const rawNoteId = normalizeQueryReferenceId(
    resolveQueryValueByKeys(
      query,
      resolveReferenceQueryKeys("noteIds", {
        multi: true
      })
    )
  );

  return {
    offset,
    limit,
    search,
    status: recordProfile.statusSet.has(status) ? status : "",
    noteId: rawNoteId
  };
}

export async function buildRecordItemsPayload(state, query = {}, profile = null) {
  const { limit, offset, search, status, noteId } = parseRecordQuery(query, profile);
  const projected = resolveRecordRows(state).map((row) => ({
    ...row,
    noteIds: [...(row.noteIds ?? [])]
  }));
  const sorted = [...projected].sort((a, b) => a.title.localeCompare(b.title));
  const filtered = sorted.filter((row) => {
    if (status.length > 0 && row.status !== status) {
      return false;
    }

    if (noteId.length > 0 && !(row.noteIds ?? []).includes(noteId)) {
      return false;
    }

    if (search.length > 0 && !row.title.toLowerCase().includes(search)) {
      return false;
    }

    return true;
  });
  const total = filtered.length;
  const items = filtered
    .slice(offset, offset + limit)
    .map((row) => resolveRecordRow(row, state));

  return {
    items,
    meta: {
      total,
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

export function parseNoteQuery(query = {}, profile = null) {
  const noteProfile = resolveNoteQueryProfile(profile);
  const offset = parsePagination(query.offset, 0);
  const limit = Math.max(1, Math.min(parsePagination(query.limit, 25), 200));
  const search = typeof query.search === "string" ? query.search.trim().toLowerCase() : "";
  const category = normalizeQueryToken(query.category);
  const labels = uniqueIds(parseCsvIds(query.labels).map(normalizeQueryToken)).filter((label) =>
    noteProfile.labelSet.has(label)
  );
  const rawRecordId = normalizeQueryReferenceId(
    resolveQueryValueByKeys(query, resolveReferenceQueryKeys("recordId"))
  );

  return {
    offset,
    limit,
    search,
    category: noteProfile.categorySet.has(category) ? category : "",
    labels,
    recordId: rawRecordId
  };
}

export async function buildNoteItemsPayload(state, query = {}, profile = null) {
  const { limit, offset, search, category, labels, recordId } = parseNoteQuery(query, profile);
  const projected = resolveNoteRows(state).map((row) => ({
    ...row,
    labels: [...(row.labels ?? [])]
  }));
  const sorted = [...projected].sort((a, b) => a.title.localeCompare(b.title));
  const filtered = sorted.filter((row) => {
    if (category.length > 0 && row.category !== category) {
      return false;
    }

    if (labels.length > 0 && !labels.every((label) => (row.labels ?? []).includes(label))) {
      return false;
    }

    if (recordId.length > 0 && row.recordId !== recordId) {
      return false;
    }

    if (search.length > 0 && !row.title.toLowerCase().includes(search)) {
      return false;
    }

    return true;
  });
  const total = filtered.length;
  const items = filtered
    .slice(offset, offset + limit)
    .map((row) => resolveNoteRow(row, state));

  return {
    items,
    meta: {
      total,
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

export function validateNoteReference(state, recordId) {
  if (recordId === null) {
    return null;
  }

  if (!findRecordById(state, recordId)) {
    return {
      code: "NOTE_RECORD_NOT_FOUND",
      message: `Record '${recordId}' was not found for note reference`
    };
  }

  return null;
}

export function validateRecordNoteReferences(state, noteIds) {
  for (const noteId of noteIds ?? []) {
    if (!findNoteById(state, noteId)) {
      return {
        code: "RECORD_NOTE_ID_NOT_FOUND",
        message: `Note '${noteId}' was not found for record reference`
      };
    }
  }

  return null;
}
