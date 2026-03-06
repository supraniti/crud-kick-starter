import {
  createAllowSafeguard,
  createSchemaValidationStage
} from "./mutation-runtime-helpers.mjs";

function resolveRecordSchemaValidationHook(schemaTypeRegistry) {
  return createSchemaValidationStage({
    schemaTypeRegistry,
    typeKey: "reference-record-item",
    errorCode: "RECORD_SCHEMA_VALIDATION_FAILED"
  });
}

function resolveNoteSchemaValidationHook(schemaTypeRegistry) {
  return createSchemaValidationStage({
    schemaTypeRegistry,
    typeKey: "reference-note-item",
    errorCode: "NOTE_SCHEMA_VALIDATION_FAILED"
  });
}

function createRecordValidationHook({
  workingState,
  validateRecordNoteReferences,
  validateRecordCrossFieldConstraints
}) {
  return async (input) => {
    const referenceError = validateRecordNoteReferences(workingState, input.next.noteIds);
    if (referenceError) {
      return {
        ok: false,
        errors: [referenceError]
      };
    }

    const crossFieldError = validateRecordCrossFieldConstraints({
      status: input.next.status,
      publishedOn: input.next.publishedOn ?? null
    });
    if (crossFieldError) {
      return {
        ok: false,
        errors: [crossFieldError]
      };
    }

    return {
      ok: true
    };
  };
}

function createNoteValidationHook({
  workingState,
  validateNoteCrossFieldConstraints,
  validateNoteReference
}) {
  return async (input) => {
    const crossFieldError = validateNoteCrossFieldConstraints({
      labels: input.next.labels ?? [],
      dueDate: input.next.dueDate ?? null
    });
    if (crossFieldError) {
      return {
        ok: false,
        errors: [crossFieldError]
      };
    }

    const referenceError = validateNoteReference(workingState, input.next.recordId);
    if (referenceError) {
      return {
        ok: false,
        errors: [referenceError]
      };
    }

    return {
      ok: true
    };
  };
}

function buildConflictMutationResult(conflictCode, label, value) {
  return {
    ok: false,
    error: {
      code: conflictCode,
      message: `${label} title '${value}' already exists`,
      statusCode: 409
    }
  };
}

function createRecordApplyMutationHook({
  workingState,
  hasRecordTitleConflict,
  slugifyTitle,
  isUpdate
}) {
  return async (input) => {
    const hasConflict = isUpdate
      ? hasRecordTitleConflict(workingState, input.next.title, input.current.id)
      : hasRecordTitleConflict(workingState, input.next.title);
    if (hasConflict) {
      return buildConflictMutationResult("RECORD_TITLE_CONFLICT", "Record", input.next.title);
    }

    if (!isUpdate) {
      const item = {
        ...input.next,
        noteIds: [...(input.next.noteIds ?? [])],
        slug: slugifyTitle(input.next.title)
      };
      workingState.records.push(item);
      return {
        ok: true,
        result: item
      };
    }

    const item = input.current;
    item.title = input.next.title;
    item.status = input.next.status;
    item.score = input.next.score;
    item.featured = input.next.featured;
    item.publishedOn = input.next.publishedOn;
    item.noteIds = [...(input.next.noteIds ?? [])];
    item.slug = slugifyTitle(input.next.title);
    return {
      ok: true,
      result: item
    };
  };
}

function createNoteApplyMutationHook({
  workingState,
  hasNoteTitleConflict,
  slugifyTitle,
  isUpdate
}) {
  return async (input) => {
    const hasConflict = isUpdate
      ? hasNoteTitleConflict(workingState, input.next.title, input.current.id)
      : hasNoteTitleConflict(workingState, input.next.title);
    if (hasConflict) {
      return buildConflictMutationResult("NOTE_TITLE_CONFLICT", "Note", input.next.title);
    }

    if (!isUpdate) {
      const item = {
        ...input.next,
        labels: [...(input.next.labels ?? [])],
        slug: slugifyTitle(input.next.title)
      };
      workingState.notes.push(item);
      return {
        ok: true,
        result: item
      };
    }

    const item = input.current;
    item.title = input.next.title;
    item.category = input.next.category;
    item.labels = [...(input.next.labels ?? [])];
    item.priority = input.next.priority;
    item.pinned = input.next.pinned;
    item.dueDate = input.next.dueDate;
    item.recordId = input.next.recordId;
    item.slug = slugifyTitle(input.next.title);
    return {
      ok: true,
      result: item
    };
  };
}

function createEvaluateSafeguardHook() {
  return async (safeguardInput) => createAllowSafeguard(safeguardInput);
}

function createRecordPipelineFactory({
  createMutationPipeline,
  schemaTypeRegistry,
  validateRecordNoteReferences,
  validateRecordCrossFieldConstraints,
  hasRecordTitleConflict,
  slugifyTitle,
  isUpdate
}) {
  const validateField = resolveRecordSchemaValidationHook(schemaTypeRegistry);
  const evaluateSafeguard = createEvaluateSafeguardHook();
  return (workingState) =>
    createMutationPipeline({
      hooks: {
        validateField,
        validateItem: createRecordValidationHook({
          workingState,
          validateRecordNoteReferences,
          validateRecordCrossFieldConstraints
        }),
        evaluateSafeguard,
        applyMutation: createRecordApplyMutationHook({
          workingState,
          hasRecordTitleConflict,
          slugifyTitle,
          isUpdate
        })
      }
    });
}

function createNotePipelineFactory({
  createMutationPipeline,
  schemaTypeRegistry,
  validateNoteCrossFieldConstraints,
  validateNoteReference,
  hasNoteTitleConflict,
  slugifyTitle,
  isUpdate
}) {
  const validateField = resolveNoteSchemaValidationHook(schemaTypeRegistry);
  const evaluateSafeguard = createEvaluateSafeguardHook();
  return (workingState) =>
    createMutationPipeline({
      hooks: {
        validateField,
        validateItem: createNoteValidationHook({
          workingState,
          validateNoteCrossFieldConstraints,
          validateNoteReference
        }),
        evaluateSafeguard,
        applyMutation: createNoteApplyMutationHook({
          workingState,
          hasNoteTitleConflict,
          slugifyTitle,
          isUpdate
        })
      }
    });
}

function createCollectionPipelineFactories({
  createMutationPipeline,
  schemaTypeRegistry,
  validateRecordNoteReferences,
  validateRecordCrossFieldConstraints,
  hasRecordTitleConflict,
  slugifyTitle,
  validateNoteCrossFieldConstraints,
  validateNoteReference,
  hasNoteTitleConflict
}) {
  const createRecordsCreatePipeline = createRecordPipelineFactory({
    createMutationPipeline,
    schemaTypeRegistry,
    validateRecordNoteReferences,
    validateRecordCrossFieldConstraints,
    hasRecordTitleConflict,
    slugifyTitle,
    isUpdate: false
  });
  const createRecordsUpdatePipeline = createRecordPipelineFactory({
    createMutationPipeline,
    schemaTypeRegistry,
    validateRecordNoteReferences,
    validateRecordCrossFieldConstraints,
    hasRecordTitleConflict,
    slugifyTitle,
    isUpdate: true
  });
  const createNotesCreatePipeline = createNotePipelineFactory({
    createMutationPipeline,
    schemaTypeRegistry,
    validateNoteCrossFieldConstraints,
    validateNoteReference,
    hasNoteTitleConflict,
    slugifyTitle,
    isUpdate: false
  });
  const createNotesUpdatePipeline = createNotePipelineFactory({
    createMutationPipeline,
    schemaTypeRegistry,
    validateNoteCrossFieldConstraints,
    validateNoteReference,
    hasNoteTitleConflict,
    slugifyTitle,
    isUpdate: true
  });

  return {
    createRecordsCreatePipeline,
    createRecordsUpdatePipeline,
    createNotesCreatePipeline,
    createNotesUpdatePipeline
  };
}

export { createCollectionPipelineFactories };
