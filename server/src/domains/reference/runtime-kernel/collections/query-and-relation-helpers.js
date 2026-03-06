import {
  NOTE_INPUT_FIELDS,
  isIsoDateString,
  normalizeNoteInput,
  resolveNoteValidationProfile
} from "./validation-helpers.js";

function shouldValidateField(partial, input, fieldId) {
  return !partial || input?.[fieldId] !== undefined;
}

function validateUnknownNoteFields(input, errors) {
  const unknownField = Object.keys(input).find((field) => !NOTE_INPUT_FIELDS.has(field));
  if (!unknownField) {
    return;
  }

  errors.push({
    code: "NOTE_FIELD_UNKNOWN",
    message: `Note field '${unknownField}' is not supported`
  });
}

function validateNoteTitle(normalized, noteProfile, errors) {
  if (normalized.title.length === 0) {
    errors.push({
      code: "NOTE_TITLE_REQUIRED",
      message: "Note title is required"
    });
    return;
  }

  if (normalized.title.length < noteProfile.titleMinLength) {
    errors.push({
      code: "NOTE_TITLE_TOO_SHORT",
      message: `Note title must be at least ${noteProfile.titleMinLength} characters`
    });
    return;
  }

  if (normalized.title.length > noteProfile.titleMaxLength) {
    errors.push({
      code: "NOTE_TITLE_TOO_LONG",
      message: `Note title must be at most ${noteProfile.titleMaxLength} characters`
    });
  }
}

function validateNoteCategory(normalized, noteProfile, errors) {
  if (noteProfile.categorySet.has(normalized.category)) {
    return;
  }

  errors.push({
    code: "NOTE_CATEGORY_INVALID",
    message: `Note category must be one of: ${noteProfile.categories.join(", ")}`
  });
}

function validateNoteLabels(normalized, noteProfile, partial, errors) {
  if (normalized.labels === undefined) {
    if (!partial) {
      normalized.labels = [];
    }
    return;
  }

  if (normalized.labels === "__INVALID__") {
    errors.push({
      code: "NOTE_LABELS_INVALID",
      message: "Note labels must be an array of strings"
    });
    return;
  }

  if (normalized.labels.some((label) => !noteProfile.labelSet.has(label))) {
    errors.push({
      code: "NOTE_LABEL_INVALID",
      message: `Note labels must be from: ${noteProfile.labels.join(", ")}`
    });
  }
}

function validateNotePriority(normalized, noteProfile, errors) {
  if (
    Number.isInteger(normalized.priority) &&
    normalized.priority >= noteProfile.priorityMin &&
    normalized.priority <= noteProfile.priorityMax
  ) {
    return;
  }

  errors.push({
    code: "NOTE_PRIORITY_INVALID",
    message: `Note priority must be an integer between ${noteProfile.priorityMin} and ${noteProfile.priorityMax}`
  });
}

function validateNotePinned(normalized, partial, errors) {
  if (normalized.pinned === undefined) {
    if (!partial) {
      normalized.pinned = false;
    }
    return;
  }

  if (normalized.pinned === "__INVALID__" || typeof normalized.pinned !== "boolean") {
    errors.push({
      code: "NOTE_PINNED_INVALID",
      message: "Note pinned value must be boolean"
    });
  }
}

function validateNoteDueDate(normalized, errors) {
  if (normalized.dueDate === "__INVALID__") {
    errors.push({
      code: "NOTE_DUE_DATE_INVALID",
      message: "Note dueDate must be null or an ISO date (YYYY-MM-DD)"
    });
    return;
  }

  if (normalized.dueDate !== null && !isIsoDateString(normalized.dueDate)) {
    errors.push({
      code: "NOTE_DUE_DATE_INVALID",
      message: "Note dueDate must be null or an ISO date (YYYY-MM-DD)"
    });
  }
}

function validateNoteRecordId(normalized, errors) {
  if (normalized.recordId !== "__INVALID__") {
    return;
  }

  errors.push({
    code: "NOTE_RECORD_ID_INVALID",
    message: "Note recordId must be null or a string id"
  });
}

export function validateNoteInput(input, options = {}, profile = null) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      value: normalizeNoteInput({}, profile),
      errors: [
        {
          code: "NOTE_PAYLOAD_INVALID",
          message: "Note payload must be an object"
        }
      ]
    };
  }

  const partial = options.partial === true;
  const noteProfile = resolveNoteValidationProfile(profile);
  const normalized = normalizeNoteInput(input ?? {}, noteProfile);
  const errors = [];
  validateUnknownNoteFields(input, errors);

  if (shouldValidateField(partial, input, "title")) {
    validateNoteTitle(normalized, noteProfile, errors);
  }
  if (shouldValidateField(partial, input, "category")) {
    validateNoteCategory(normalized, noteProfile, errors);
  }
  if (shouldValidateField(partial, input, "labels")) {
    validateNoteLabels(normalized, noteProfile, partial, errors);
  }
  if (shouldValidateField(partial, input, "priority")) {
    validateNotePriority(normalized, noteProfile, errors);
  }
  if (shouldValidateField(partial, input, "pinned")) {
    validateNotePinned(normalized, partial, errors);
  }
  if (shouldValidateField(partial, input, "dueDate")) {
    validateNoteDueDate(normalized, errors);
  }
  if (shouldValidateField(partial, input, "recordId")) {
    validateNoteRecordId(normalized, errors);
  }

  return {
    ok: errors.length === 0,
    value: normalized,
    errors
  };
}

export {
  buildNoteItemsPayload,
  buildRecordItemsPayload,
  findNoteById,
  findRecordById,
  hasNoteTitleConflict,
  hasRecordTitleConflict,
  nextNoteId,
  parseNoteQuery,
  parseRecordQuery,
  resolveNoteRow,
  resolveRecordRow,
  validateNoteCrossFieldConstraints,
  validateNoteReference,
  validateRecordNoteReferences
} from "../../../../domains/reference/query-runtime/records-notes-query-runtime.js";
