import { vi } from "vitest";
import {
  buildNoteList,
  buildRecordList,
  ensureNoteCrossField,
  ensureNoteReference,
  ensureRecordCrossField,
  ensureRecordReferences,
  findNote,
  findRecord,
  hasNoteTitleConflict,
  hasRecordTitleConflict,
  markDeployRequired,
  normalizeNotePayload,
  normalizeRecordPayload,
  resolveNotes,
  resolveRecords,
  slugifyTitle,
  toId,
  isCollectionActive
} from "./state.js";

function collectionNotFound(collectionId) {
  return {
    ok: false,
    error: {
      code: "COLLECTION_NOT_FOUND",
      message: `Collection '${collectionId}' was not found`
    }
  };
}

function ensureCollectionAvailable(state, collectionId) {
  return isCollectionActive(state, collectionId) ? null : collectionNotFound(collectionId);
}

function cloneCollectionSchema(schema) {
  if (!schema || typeof schema !== "object") {
    return null;
  }

  return {
    ...schema,
    fields: Array.isArray(schema.fields) ? schema.fields.map((field) => ({ ...field })) : []
  };
}

function resolveReferenceCollectionIds(schema) {
  if (!Array.isArray(schema?.fields)) {
    return [];
  }

  return [...new Set(
    schema.fields
      .filter((field) => field && typeof field === "object")
      .filter((field) => field.type === "reference" || field.type === "reference-multi")
      .map((field) => (typeof field.collectionId === "string" ? field.collectionId : ""))
      .filter((collectionId) => collectionId.length > 0)
  )];
}

function buildCollectionListPayload(state, collectionId, query) {
  if (collectionId === "records") {
    return buildRecordList(state, query);
  }

  if (collectionId === "notes") {
    return buildNoteList(state, query);
  }

  return null;
}

function buildReferenceOptionsItems(state, collectionId) {
  if (collectionId === "records") {
    return resolveRecords(state);
  }

  if (collectionId === "notes") {
    return resolveNotes(state);
  }

  return null;
}

function collectionItemNotFound(itemKind, itemId) {
  return {
    ok: false,
    error: {
      code: "ITEM_NOT_FOUND",
      message: `${itemKind} '${itemId}' was not found`
    }
  };
}

function collectionReferenceOptionsNotFound(referenceCollectionId) {
  return {
    items: [],
    errorMessage: `Collection '${referenceCollectionId}' was not found`
  };
}

function buildWorkspaceReferenceOptions(state, collectionSchema) {
  const referenceOptions = {};

  for (const referenceCollectionId of resolveReferenceCollectionIds(collectionSchema)) {
    if (!isCollectionActive(state, referenceCollectionId)) {
      referenceOptions[referenceCollectionId] = collectionReferenceOptionsNotFound(referenceCollectionId);
      continue;
    }

    const optionItems = buildReferenceOptionsItems(state, referenceCollectionId);
    referenceOptions[referenceCollectionId] = optionItems
      ? {
          items: optionItems,
          errorMessage: null
        }
      : collectionReferenceOptionsNotFound(referenceCollectionId);
  }

  return referenceOptions;
}

function createRecordCollectionItem(state, item) {
  const next = normalizeRecordPayload(item ?? {});
  if (hasRecordTitleConflict(state, next.title)) {
    return {
      ok: false,
      error: {
        code: "RECORD_TITLE_CONFLICT",
        message: `Record title '${next.title}' already exists`
      }
    };
  }

  const refs = ensureRecordReferences(state, next.noteIds);
  if (!refs.ok) {
    return {
      ok: false,
      error: refs.error
    };
  }

  const crossField = ensureRecordCrossField(next);
  if (!crossField.ok) {
    return {
      ok: false,
      error: crossField.error
    };
  }

  const created = {
    id: toId("rec", state.nextRecordNumber++),
    ...next,
    slug: slugifyTitle(next.title)
  };
  state.records.push(created);
  markDeployRequired(state);

  return {
    ok: true,
    item: resolveRecords(state).find((row) => row.id === created.id)
  };
}

function createNoteCollectionItem(state, item) {
  const next = normalizeNotePayload(item ?? {});
  if (hasNoteTitleConflict(state, next.title)) {
    return {
      ok: false,
      error: {
        code: "NOTE_TITLE_CONFLICT",
        message: `Note title '${next.title}' already exists`
      }
    };
  }

  const reference = ensureNoteReference(state, next.recordId);
  if (!reference.ok) {
    return {
      ok: false,
      error: reference.error
    };
  }

  const crossField = ensureNoteCrossField(next);
  if (!crossField.ok) {
    return {
      ok: false,
      error: crossField.error
    };
  }

  const created = {
    id: toId("note", state.nextNoteNumber++),
    ...next,
    slug: slugifyTitle(next.title)
  };
  state.notes.push(created);
  markDeployRequired(state);

  return {
    ok: true,
    item: resolveNotes(state).find((row) => row.id === created.id)
  };
}

function updateRecordCollectionItem(state, itemId, item) {
  const existing = findRecord(state, itemId);
  if (!existing) {
    return collectionItemNotFound("Record", itemId);
  }

  const next = normalizeRecordPayload(item ?? {});
  if (hasRecordTitleConflict(state, next.title, existing.id)) {
    return {
      ok: false,
      error: {
        code: "RECORD_TITLE_CONFLICT",
        message: `Record title '${next.title}' already exists`
      }
    };
  }

  const refs = ensureRecordReferences(state, next.noteIds);
  if (!refs.ok) {
    return {
      ok: false,
      error: refs.error
    };
  }

  const crossField = ensureRecordCrossField(next);
  if (!crossField.ok) {
    return {
      ok: false,
      error: crossField.error
    };
  }

  Object.assign(existing, {
    ...next,
    slug: slugifyTitle(next.title)
  });
  markDeployRequired(state);

  return {
    ok: true,
    item: resolveRecords(state).find((row) => row.id === existing.id)
  };
}

function updateNoteCollectionItem(state, itemId, item) {
  const existing = findNote(state, itemId);
  if (!existing) {
    return collectionItemNotFound("Note", itemId);
  }

  const next = normalizeNotePayload(item ?? {});
  if (hasNoteTitleConflict(state, next.title, existing.id)) {
    return {
      ok: false,
      error: {
        code: "NOTE_TITLE_CONFLICT",
        message: `Note title '${next.title}' already exists`
      }
    };
  }

  const reference = ensureNoteReference(state, next.recordId);
  if (!reference.ok) {
    return {
      ok: false,
      error: reference.error
    };
  }

  const crossField = ensureNoteCrossField(next);
  if (!crossField.ok) {
    return {
      ok: false,
      error: crossField.error
    };
  }

  Object.assign(existing, {
    ...next,
    slug: slugifyTitle(next.title)
  });
  markDeployRequired(state);

  return {
    ok: true,
    item: resolveNotes(state).find((row) => row.id === existing.id)
  };
}

function deleteRecordCollectionItem(state, itemId) {
  const index = state.records.findIndex((item) => item.id === itemId);
  if (index < 0) {
    return collectionItemNotFound("Record", itemId);
  }

  state.records.splice(index, 1);
  for (const note of state.notes) {
    if (note.recordId === itemId) {
      note.recordId = null;
    }
  }
  markDeployRequired(state);

  return {
    ok: true,
    removed: {
      id: itemId
    }
  };
}

function deleteNoteCollectionItem(state, itemId) {
  const index = state.notes.findIndex((item) => item.id === itemId);
  if (index < 0) {
    return collectionItemNotFound("Note", itemId);
  }

  state.notes.splice(index, 1);
  for (const record of state.records) {
    record.noteIds = (record.noteIds ?? []).filter((noteId) => noteId !== itemId);
  }
  markDeployRequired(state);

  return {
    ok: true,
    removed: {
      id: itemId
    }
  };
}

const CREATE_COLLECTION_ITEM_HANDLERS = Object.freeze({
  records: createRecordCollectionItem,
  notes: createNoteCollectionItem
});

const UPDATE_COLLECTION_ITEM_HANDLERS = Object.freeze({
  records: updateRecordCollectionItem,
  notes: updateNoteCollectionItem
});

const DELETE_COLLECTION_ITEM_HANDLERS = Object.freeze({
  records: deleteRecordCollectionItem,
  notes: deleteNoteCollectionItem
});

function resolveCollectionOperationHandler(handlerMap, collectionId) {
  return handlerMap[collectionId] ?? null;
}

function createListCollectionItemsHandler(state) {
  return async ({ collectionId, ...query }) => {
    const unavailable = ensureCollectionAvailable(state, collectionId);
    if (unavailable) {
      return unavailable;
    }

    const listPayload = buildCollectionListPayload(state, collectionId, query);
    return listPayload
      ? {
          ok: true,
          ...listPayload
        }
      : collectionNotFound(collectionId);
  };
}

function createReadCollectionWorkspaceHandler(state) {
  return async ({ collectionId, ...query }) => {
    const unavailable = ensureCollectionAvailable(state, collectionId);
    if (unavailable) {
      return unavailable;
    }

    const collectionSchema = cloneCollectionSchema(state.collectionSchemas?.[collectionId]);
    if (!collectionSchema) {
      return collectionNotFound(collectionId);
    }

    const listPayload = buildCollectionListPayload(state, collectionId, query);
    if (!listPayload) {
      return collectionNotFound(collectionId);
    }

    return {
      ok: true,
      collectionId,
      collection: collectionSchema,
      items: listPayload.items,
      meta: listPayload.meta,
      filters: listPayload.filters,
      referenceOptions: buildWorkspaceReferenceOptions(state, collectionSchema)
    };
  };
}

function createCreateCollectionItemHandler(state) {
  return async ({ collectionId, item }) => {
    const unavailable = ensureCollectionAvailable(state, collectionId);
    if (unavailable) {
      return unavailable;
    }

    const operation = resolveCollectionOperationHandler(CREATE_COLLECTION_ITEM_HANDLERS, collectionId);
    return typeof operation === "function"
      ? operation(state, item)
      : collectionNotFound(collectionId);
  };
}

function createUpdateCollectionItemHandler(state) {
  return async ({ collectionId, itemId, item }) => {
    const unavailable = ensureCollectionAvailable(state, collectionId);
    if (unavailable) {
      return unavailable;
    }

    const operation = resolveCollectionOperationHandler(UPDATE_COLLECTION_ITEM_HANDLERS, collectionId);
    return typeof operation === "function"
      ? operation(state, itemId, item)
      : collectionNotFound(collectionId);
  };
}

function createDeleteCollectionItemHandler(state) {
  return async ({ collectionId, itemId }) => {
    const unavailable = ensureCollectionAvailable(state, collectionId);
    if (unavailable) {
      return unavailable;
    }

    const operation = resolveCollectionOperationHandler(DELETE_COLLECTION_ITEM_HANDLERS, collectionId);
    return typeof operation === "function"
      ? operation(state, itemId)
      : collectionNotFound(collectionId);
  };
}

export function buildCollectionsApi(state) {
  return {
    listCollectionItems: vi.fn().mockImplementation(createListCollectionItemsHandler(state)),
    readCollectionWorkspace: vi.fn().mockImplementation(createReadCollectionWorkspaceHandler(state)),
    createCollectionItem: vi.fn().mockImplementation(createCreateCollectionItemHandler(state)),
    updateCollectionItem: vi.fn().mockImplementation(createUpdateCollectionItemHandler(state)),
    deleteCollectionItem: vi.fn().mockImplementation(createDeleteCollectionItemHandler(state))
  };
}
