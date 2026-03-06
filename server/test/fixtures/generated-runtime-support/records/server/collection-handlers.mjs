import {
  buildCollectionSchemaTypeRegistry,
  errorPayload,
  runMutationPipeline
} from "./collection-handlers/mutation-runtime-helpers.mjs";
import { createCollectionPipelineFactories } from "./collection-handlers/pipeline-factories.mjs";
import {
  buildNoteItemsPayload as buildNoteItemsPayloadDefault,
  buildRecordItemsPayload as buildRecordItemsPayloadDefault,
  findNoteById as findNoteByIdDefault,
  findRecordById as findRecordByIdDefault,
  hasNoteTitleConflict as hasNoteTitleConflictDefault,
  hasRecordTitleConflict as hasRecordTitleConflictDefault,
  nextNoteId as nextNoteIdDefault,
  resolveNoteRow as resolveNoteRowDefault,
  resolveRecordRow as resolveRecordRowDefault,
  validateNoteCrossFieldConstraints as validateNoteCrossFieldConstraintsDefault,
  validateNoteReference as validateNoteReferenceDefault,
  validateRecordNoteReferences as validateRecordNoteReferencesDefault
} from "./records-notes-query-runtime.mjs";

function toRecordCreateNext(state, value, slugifyTitle, nextRecordId) {
  return {
    id: nextRecordId(state),
    title: value.title,
    status: value.status,
    score: value.score,
    featured: value.featured ?? false,
    publishedOn: value.publishedOn ?? null,
    noteIds: [...(value.noteIds ?? [])],
    slug: slugifyTitle(value.title)
  };
}

function toRecordUpdateNext(item, body, value, slugifyTitle) {
  const title = body.title !== undefined ? value.title : item.title;
  return {
    id: item.id,
    title,
    status: body.status !== undefined ? value.status : item.status,
    score: body.score !== undefined ? value.score : item.score,
    featured: body.featured !== undefined ? value.featured : item.featured,
    publishedOn:
      body.publishedOn !== undefined ? value.publishedOn : item.publishedOn ?? null,
    noteIds:
      body.noteIds !== undefined ? [...(value.noteIds ?? [])] : [...(item.noteIds ?? [])],
    slug: slugifyTitle(title)
  };
}

function toNoteCreateNext(state, value, slugifyTitle, nextNoteId) {
  return {
    id: nextNoteId(state),
    title: value.title,
    category: value.category,
    labels: [...(value.labels ?? [])],
    priority: value.priority,
    pinned: value.pinned ?? false,
    dueDate: value.dueDate ?? null,
    recordId: value.recordId ?? null,
    slug: slugifyTitle(value.title)
  };
}

function toNoteUpdateNext(item, body, value, slugifyTitle) {
  const title = body.title !== undefined ? value.title : item.title;
  return {
    id: item.id,
    title,
    category: body.category !== undefined ? value.category : item.category,
    labels: body.labels !== undefined ? [...(value.labels ?? [])] : [...(item.labels ?? [])],
    priority: body.priority !== undefined ? value.priority : item.priority,
    pinned: body.pinned !== undefined ? value.pinned : item.pinned,
    dueDate: body.dueDate !== undefined ? value.dueDate : item.dueDate ?? null,
    recordId: body.recordId !== undefined ? value.recordId : item.recordId ?? null,
    slug: slugifyTitle(title)
  };
}

function assertCreateMutationPipeline(createMutationPipeline) {
  if (typeof createMutationPipeline !== "function") {
    throw new Error("createMutationPipeline is required for records collection handlers");
  }
}

function resolveRepository({
  resolveCollectionRepository,
  recordsNotesRepository
}) {
  const pluginRepository =
    typeof resolveCollectionRepository === "function"
      ? resolveCollectionRepository("records") ?? resolveCollectionRepository("notes")
      : null;
  const repositoryCandidate = pluginRepository ?? recordsNotesRepository;
  return (
    repositoryCandidate &&
    typeof repositoryCandidate.readState === "function" &&
    typeof repositoryCandidate.transact === "function"
      ? repositoryCandidate
      : null
  );
}

function createWorkingStateRuntime({ repository, state }) {
  const readWorkingState = async () => (repository ? repository.readState() : state);
  const mutateWorkingState = async (mutator) => {
    if (repository) {
      return repository.transact(mutator);
    }

    const outcome = await mutator(state);
    return Object.prototype.hasOwnProperty.call(outcome ?? {}, "value")
      ? outcome.value
      : outcome;
  };

  return {
    readWorkingState,
    mutateWorkingState
  };
}

function resolveCollectionValidationProfiles({
  buildCollectionValidationProfiles,
  manifest
}) {
  return (
    typeof buildCollectionValidationProfiles === "function"
      ? buildCollectionValidationProfiles(manifest)
      : {}
  );
}

function createCollectionPipelines({
  createMutationPipeline,
  createSchemaTypeRegistry,
  validateRecordNoteReferences,
  validateRecordCrossFieldConstraints,
  hasRecordTitleConflict,
  slugifyTitle,
  validateNoteCrossFieldConstraints,
  validateNoteReference,
  hasNoteTitleConflict
}) {
  const schemaTypeRegistry = buildCollectionSchemaTypeRegistry(createSchemaTypeRegistry);
  return createCollectionPipelineFactories({
    createMutationPipeline,
    schemaTypeRegistry,
    validateRecordNoteReferences,
    validateRecordCrossFieldConstraints,
    hasRecordTitleConflict,
    slugifyTitle,
    validateNoteCrossFieldConstraints,
    validateNoteReference,
    hasNoteTitleConflict
  });
}

function buildMissingItemMutationResult(item, collectionId) {
  return {
    commit: false,
    value: {
      ok: false,
      statusCode: 404,
      payload: errorPayload(
        "ITEM_NOT_FOUND",
        `Item '${item?.id ?? "unknown"}' was not found in collection '${collectionId}'`
      )
    }
  };
}

function createRecordReadHandler({
  readWorkingState,
  buildRecordItemsPayload,
  recordValidationProfile,
  findRecordById,
  resolveRecordRow,
  validateRecordInput
}) {
  return {
    list: async (query) => {
      const workingState = await readWorkingState();
      return buildRecordItemsPayload(workingState, query, recordValidationProfile);
    },
    findById: async (itemId) => {
      const workingState = await readWorkingState();
      return findRecordById(workingState, itemId);
    },
    resolveRow: async (item) => {
      const workingState = await readWorkingState();
      return resolveRecordRow(item, workingState);
    },
    validateInput: (input, options) =>
      validateRecordInput(input, options, recordValidationProfile),
    hasAnyMutableField: (body) =>
      body.title !== undefined ||
      body.status !== undefined ||
      body.score !== undefined ||
      body.featured !== undefined ||
      body.publishedOn !== undefined ||
      body.noteIds !== undefined,
    emptyUpdateCode: "RECORD_UPDATE_EMPTY",
    findIndex: async (itemId) => {
      const workingState = await readWorkingState();
      return workingState.records.findIndex((row) => row.id === itemId);
    }
  };
}

function createRecordMutationHandler({
  mutateWorkingState,
  createRecordsCreatePipeline,
  createRecordsUpdatePipeline,
  badRequest,
  findRecordById,
  slugifyTitle,
  nextRecordId
}) {
  return {
    create: ({ value, reply }) =>
      mutateWorkingState(async (workingState) => {
        const next = toRecordCreateNext(workingState, value, slugifyTitle, nextRecordId);
        const result = await runMutationPipeline({
          pipeline: createRecordsCreatePipeline(workingState),
          input: {
            action: "create",
            entityType: "record",
            entityId: next.id,
            current: null,
            next
          },
          reply,
          badRequest,
          fallbackCode: "RECORD_MUTATION_FAILED"
        });

        return {
          commit: result.ok,
          value: result
        };
      }),
    update: ({ body, value, item, reply }) =>
      mutateWorkingState(async (workingState) => {
        const currentItem = findRecordById(workingState, item?.id);
        if (!currentItem) {
          return buildMissingItemMutationResult(item, "records");
        }

        const next = toRecordUpdateNext(currentItem, body, value, slugifyTitle);
        const result = await runMutationPipeline({
          pipeline: createRecordsUpdatePipeline(workingState),
          input: {
            action: "update",
            entityType: "record",
            entityId: currentItem.id,
            current: currentItem,
            next
          },
          reply,
          badRequest,
          fallbackCode: "RECORD_MUTATION_FAILED"
        });

        return {
          commit: result.ok,
          value: result
        };
      }),
    removeByIndex: (_, itemId) =>
      mutateWorkingState(async (workingState) => {
        const index = workingState.records.findIndex((row) => row.id === itemId);
        if (index < 0) {
          return {
            commit: false,
            value: null
          };
        }

        workingState.records.splice(index, 1);
        for (const note of workingState.notes) {
          if (note.recordId === itemId) {
            note.recordId = null;
          }
        }

        return {
          commit: true,
          value: null
        };
      })
  };
}

function createRecordCollectionHandler(params) {
  return {
    ...createRecordReadHandler(params),
    ...createRecordMutationHandler(params)
  };
}

function createNoteReadHandler({
  readWorkingState,
  buildNoteItemsPayload,
  noteValidationProfile,
  findNoteById,
  resolveNoteRow,
  validateNoteInput
}) {
  return {
    list: async (query) => {
      const workingState = await readWorkingState();
      return buildNoteItemsPayload(workingState, query, noteValidationProfile);
    },
    findById: async (itemId) => {
      const workingState = await readWorkingState();
      return findNoteById(workingState, itemId);
    },
    resolveRow: async (item) => {
      const workingState = await readWorkingState();
      return resolveNoteRow(item, workingState);
    },
    validateInput: (input, options) =>
      validateNoteInput(input, options, noteValidationProfile),
    hasAnyMutableField: (body) =>
      body.title !== undefined ||
      body.category !== undefined ||
      body.labels !== undefined ||
      body.priority !== undefined ||
      body.pinned !== undefined ||
      body.dueDate !== undefined ||
      body.recordId !== undefined,
    emptyUpdateCode: "NOTE_UPDATE_EMPTY",
    findIndex: async (itemId) => {
      const workingState = await readWorkingState();
      return workingState.notes.findIndex((row) => row.id === itemId);
    }
  };
}

function createNoteMutationHandler({
  mutateWorkingState,
  createNotesCreatePipeline,
  createNotesUpdatePipeline,
  badRequest,
  findNoteById,
  slugifyTitle,
  nextNoteId
}) {
  return {
    create: ({ value, reply }) =>
      mutateWorkingState(async (workingState) => {
        const next = toNoteCreateNext(workingState, value, slugifyTitle, nextNoteId);
        const result = await runMutationPipeline({
          pipeline: createNotesCreatePipeline(workingState),
          input: {
            action: "create",
            entityType: "note",
            entityId: next.id,
            current: null,
            next
          },
          reply,
          badRequest,
          fallbackCode: "NOTE_MUTATION_FAILED"
        });

        return {
          commit: result.ok,
          value: result
        };
      }),
    update: ({ body, value, item, reply }) =>
      mutateWorkingState(async (workingState) => {
        const currentItem = findNoteById(workingState, item?.id);
        if (!currentItem) {
          return buildMissingItemMutationResult(item, "notes");
        }

        const next = toNoteUpdateNext(currentItem, body, value, slugifyTitle);
        const result = await runMutationPipeline({
          pipeline: createNotesUpdatePipeline(workingState),
          input: {
            action: "update",
            entityType: "note",
            entityId: currentItem.id,
            current: currentItem,
            next
          },
          reply,
          badRequest,
          fallbackCode: "NOTE_MUTATION_FAILED"
        });

        return {
          commit: result.ok,
          value: result
        };
      }),
    removeByIndex: (_, itemId) =>
      mutateWorkingState(async (workingState) => {
        const index = workingState.notes.findIndex((row) => row.id === itemId);
        if (index < 0) {
          return {
            commit: false,
            value: null
          };
        }

        workingState.notes.splice(index, 1);
        for (const record of workingState.records) {
          if (!Array.isArray(record.noteIds) || record.noteIds.length === 0) {
            continue;
          }

          record.noteIds = record.noteIds.filter((noteId) => noteId !== itemId);
        }

        return {
          commit: true,
          value: null
        };
      })
  };
}

function createNoteCollectionHandler(params) {
  return {
    ...createNoteReadHandler(params),
    ...createNoteMutationHandler(params)
  };
}

export function registerCollectionHandlers({
  registry,
  manifest,
  state,
  createMutationPipeline,
  createSchemaTypeRegistry,
  buildCollectionValidationProfiles,
  buildRecordItemsPayload = buildRecordItemsPayloadDefault,
  buildNoteItemsPayload = buildNoteItemsPayloadDefault,
  findRecordById = findRecordByIdDefault,
  findNoteById = findNoteByIdDefault,
  resolveRecordRow = resolveRecordRowDefault,
  resolveNoteRow = resolveNoteRowDefault,
  validateRecordInput,
  validateNoteInput,
  badRequest,
  validateRecordNoteReferences = validateRecordNoteReferencesDefault,
  validateRecordCrossFieldConstraints,
  hasRecordTitleConflict = hasRecordTitleConflictDefault,
  nextRecordId,
  slugifyTitle,
  validateNoteCrossFieldConstraints = validateNoteCrossFieldConstraintsDefault,
  validateNoteReference = validateNoteReferenceDefault,
  hasNoteTitleConflict = hasNoteTitleConflictDefault,
  nextNoteId = nextNoteIdDefault,
  recordsNotesRepository,
  resolveCollectionRepository
}) {
  assertCreateMutationPipeline(createMutationPipeline);
  const repository = resolveRepository({
    resolveCollectionRepository,
    recordsNotesRepository
  });
  const { readWorkingState, mutateWorkingState } = createWorkingStateRuntime({
    repository,
    state
  });
  const validationProfiles = resolveCollectionValidationProfiles({
    buildCollectionValidationProfiles,
    manifest
  });
  const recordValidationProfile = validationProfiles.records ?? null;
  const noteValidationProfile = validationProfiles.notes ?? null;
  const {
    createRecordsCreatePipeline,
    createRecordsUpdatePipeline,
    createNotesCreatePipeline,
    createNotesUpdatePipeline
  } = createCollectionPipelines({
    createMutationPipeline,
    createSchemaTypeRegistry,
    validateRecordNoteReferences,
    validateRecordCrossFieldConstraints,
    hasRecordTitleConflict,
    slugifyTitle,
    validateNoteCrossFieldConstraints,
    validateNoteReference,
    hasNoteTitleConflict
  });

  registry.register({
    collectionId: "records",
    moduleId: "records",
    handler: createRecordCollectionHandler({
      readWorkingState,
      mutateWorkingState,
      buildRecordItemsPayload,
      recordValidationProfile,
      findRecordById,
      resolveRecordRow,
      validateRecordInput,
      createRecordsCreatePipeline,
      createRecordsUpdatePipeline,
      badRequest,
      slugifyTitle,
      nextRecordId
    })
  });

  registry.register({
    collectionId: "notes",
    moduleId: "records",
    handler: createNoteCollectionHandler({
      readWorkingState,
      mutateWorkingState,
      buildNoteItemsPayload,
      noteValidationProfile,
      findNoteById,
      resolveNoteRow,
      validateNoteInput,
      createNotesCreatePipeline,
      createNotesUpdatePipeline,
      badRequest,
      slugifyTitle,
      nextNoteId
    })
  });
}

