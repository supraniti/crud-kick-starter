
const DEFAULT_RECORD_VALIDATION_PROFILE = Object.freeze({
  titleMinLength: 3,
  titleMaxLength: 120,
  statuses: ["draft", "review", "published"],
  scoreMin: 0,
  scoreMax: 100
});

const DEFAULT_NOTE_VALIDATION_PROFILE = Object.freeze({
  titleMinLength: 3,
  titleMaxLength: 120,
  categories: ["general", "tech", "ops"],
  labels: ["action", "ops", "ui", "backend", "release"],
  priorityMin: 1,
  priorityMax: 5
});
const RECORD_INPUT_FIELDS = new Set([
  "title",
  "status",
  "score",
  "featured",
  "publishedOn",
  "noteIds"
]);
const NOTE_INPUT_FIELDS = new Set([
  "title",
  "category",
  "labels",
  "priority",
  "pinned",
  "dueDate",
  "recordId"
]);

function toFiniteNumberOrFallback(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toPositiveIntegerOrFallback(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function normalizeCollectionEnumOptions(options) {
  if (!Array.isArray(options)) {
    return [];
  }

  const values = [];
  for (const option of options) {
    const normalized =
      typeof option === "string"
        ? option.trim().toLowerCase()
        : typeof option?.value === "string"
          ? option.value.trim().toLowerCase()
          : "";
    if (normalized.length > 0 && !values.includes(normalized)) {
      values.push(normalized);
    }
  }

  return values;
}

function findCollectionDefinition(manifest, collectionId) {
  if (!Array.isArray(manifest?.collections)) {
    return null;
  }

  return manifest.collections.find((collection) => collection?.id === collectionId) ?? null;
}

function findCollectionField(collectionDefinition, fieldId) {
  if (!Array.isArray(collectionDefinition?.fields)) {
    return null;
  }

  return collectionDefinition.fields.find((field) => field?.id === fieldId) ?? null;
}

function resolveRecordValidationProfile(profile = null) {
  const source = profile && typeof profile === "object" ? profile : DEFAULT_RECORD_VALIDATION_PROFILE;
  const statuses = normalizeCollectionEnumOptions(source.statuses);
  const titleMinLength = toPositiveIntegerOrFallback(
    source.titleMinLength,
    DEFAULT_RECORD_VALIDATION_PROFILE.titleMinLength
  );
  const titleMaxLength = toPositiveIntegerOrFallback(
    source.titleMaxLength,
    DEFAULT_RECORD_VALIDATION_PROFILE.titleMaxLength
  );
  const scoreMin = toFiniteNumberOrFallback(source.scoreMin, DEFAULT_RECORD_VALIDATION_PROFILE.scoreMin);
  const scoreMax = toFiniteNumberOrFallback(source.scoreMax, DEFAULT_RECORD_VALIDATION_PROFILE.scoreMax);
  const normalizedStatuses =
    statuses.length > 0 ? statuses : [...DEFAULT_RECORD_VALIDATION_PROFILE.statuses];

  return {
    titleMinLength,
    titleMaxLength,
    statuses: normalizedStatuses,
    statusSet: new Set(normalizedStatuses),
    scoreMin,
    scoreMax
  };
}

function resolveNoteValidationProfile(profile = null) {
  const source = profile && typeof profile === "object" ? profile : DEFAULT_NOTE_VALIDATION_PROFILE;
  const categories = normalizeCollectionEnumOptions(source.categories);
  const labels = normalizeCollectionEnumOptions(source.labels);
  const titleMinLength = toPositiveIntegerOrFallback(
    source.titleMinLength,
    DEFAULT_NOTE_VALIDATION_PROFILE.titleMinLength
  );
  const titleMaxLength = toPositiveIntegerOrFallback(
    source.titleMaxLength,
    DEFAULT_NOTE_VALIDATION_PROFILE.titleMaxLength
  );
  const priorityMin = toFiniteNumberOrFallback(source.priorityMin, DEFAULT_NOTE_VALIDATION_PROFILE.priorityMin);
  const priorityMax = toFiniteNumberOrFallback(source.priorityMax, DEFAULT_NOTE_VALIDATION_PROFILE.priorityMax);
  const normalizedCategories =
    categories.length > 0 ? categories : [...DEFAULT_NOTE_VALIDATION_PROFILE.categories];
  const normalizedLabels = labels.length > 0 ? labels : [...DEFAULT_NOTE_VALIDATION_PROFILE.labels];

  return {
    titleMinLength,
    titleMaxLength,
    categories: normalizedCategories,
    categorySet: new Set(normalizedCategories),
    labels: normalizedLabels,
    labelSet: new Set(normalizedLabels),
    priorityMin,
    priorityMax
  };
}

export function buildCollectionValidationProfiles(manifest) {
  const recordCollection = findCollectionDefinition(manifest, "records");
  const noteCollection = findCollectionDefinition(manifest, "notes");

  const recordStatusField = findCollectionField(recordCollection, "status");
  const recordTitleField = findCollectionField(recordCollection, "title");
  const recordScoreField = findCollectionField(recordCollection, "score");

  const noteCategoryField = findCollectionField(noteCollection, "category");
  const noteLabelsField = findCollectionField(noteCollection, "labels");
  const noteTitleField = findCollectionField(noteCollection, "title");
  const notePriorityField = findCollectionField(noteCollection, "priority");

  const recordProfile = {
    titleMinLength: toPositiveIntegerOrFallback(
      recordTitleField?.minLength,
      DEFAULT_RECORD_VALIDATION_PROFILE.titleMinLength
    ),
    titleMaxLength: toPositiveIntegerOrFallback(
      recordTitleField?.maxLength,
      DEFAULT_RECORD_VALIDATION_PROFILE.titleMaxLength
    ),
    statuses: normalizeCollectionEnumOptions(recordStatusField?.options),
    scoreMin: toFiniteNumberOrFallback(recordScoreField?.min, DEFAULT_RECORD_VALIDATION_PROFILE.scoreMin),
    scoreMax: toFiniteNumberOrFallback(recordScoreField?.max, DEFAULT_RECORD_VALIDATION_PROFILE.scoreMax)
  };

  const noteProfile = {
    titleMinLength: toPositiveIntegerOrFallback(
      noteTitleField?.minLength,
      DEFAULT_NOTE_VALIDATION_PROFILE.titleMinLength
    ),
    titleMaxLength: toPositiveIntegerOrFallback(
      noteTitleField?.maxLength,
      DEFAULT_NOTE_VALIDATION_PROFILE.titleMaxLength
    ),
    categories: normalizeCollectionEnumOptions(noteCategoryField?.options),
    labels: normalizeCollectionEnumOptions(noteLabelsField?.options),
    priorityMin: toFiniteNumberOrFallback(notePriorityField?.min, DEFAULT_NOTE_VALIDATION_PROFILE.priorityMin),
    priorityMax: toFiniteNumberOrFallback(notePriorityField?.max, DEFAULT_NOTE_VALIDATION_PROFILE.priorityMax)
  };

  return {
    records: resolveRecordValidationProfile(recordProfile),
    notes: resolveNoteValidationProfile(noteProfile)
  };
}

export function normalizeRecordStatus(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

export function normalizeNoteReferenceIds(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    return "__INVALID__";
  }

  const noteIds = [];
  for (const item of value) {
    if (typeof item !== "string") {
      return "__INVALID__";
    }

    const normalized = item.trim();
    if (normalized.length > 0 && !noteIds.includes(normalized)) {
      noteIds.push(normalized);
    }
  }

  return noteIds;
}

export function normalizeRecordInput(input) {
  const rawScore = input?.score;
  const parsedScore =
    typeof rawScore === "string" && rawScore.trim().length > 0
      ? Number.parseInt(rawScore, 10)
      : Number(rawScore);

  return {
    title: typeof input?.title === "string" ? input.title.trim() : "",
    status: normalizeRecordStatus(input?.status),
    score: Number.isFinite(parsedScore) ? parsedScore : Number.NaN,
    featured:
      input?.featured === undefined
        ? undefined
        : typeof input.featured === "boolean"
          ? input.featured
          : "__INVALID__",
    publishedOn:
      input?.publishedOn === null || input?.publishedOn === undefined
        ? null
        : typeof input.publishedOn === "string"
          ? input.publishedOn.trim() || null
          : "__INVALID__",
    noteIds: normalizeNoteReferenceIds(input?.noteIds)
  };
}

export function isIsoDateString(value) {
  if (typeof value !== "string") {
    return false;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function addUnknownRecordFieldError(input, errors) {
  const unknownField = Object.keys(input).find((field) => !RECORD_INPUT_FIELDS.has(field));
  if (!unknownField) {
    return;
  }

  errors.push({
    code: "RECORD_FIELD_UNKNOWN",
    message: `Record field '${unknownField}' is not supported`
  });
}

function validateRecordTitleField({ input, normalized, partial, recordProfile, errors }) {
  if (partial && input?.title === undefined) {
    return;
  }

  if (normalized.title.length === 0) {
    errors.push({
      code: "RECORD_TITLE_REQUIRED",
      message: "Record title is required"
    });
    return;
  }
  if (normalized.title.length < recordProfile.titleMinLength) {
    errors.push({
      code: "RECORD_TITLE_TOO_SHORT",
      message: `Record title must be at least ${recordProfile.titleMinLength} characters`
    });
    return;
  }
  if (normalized.title.length > recordProfile.titleMaxLength) {
    errors.push({
      code: "RECORD_TITLE_TOO_LONG",
      message: `Record title must be at most ${recordProfile.titleMaxLength} characters`
    });
  }
}

function validateRecordStatusField({ input, normalized, partial, recordProfile, errors }) {
  if (partial && input?.status === undefined) {
    return;
  }
  if (recordProfile.statusSet.has(normalized.status)) {
    return;
  }

  errors.push({
    code: "RECORD_STATUS_INVALID",
    message: `Record status must be one of: ${recordProfile.statuses.join(", ")}`
  });
}

function validateRecordScoreField({ input, normalized, partial, recordProfile, errors }) {
  if (partial && input?.score === undefined) {
    return;
  }

  if (
    Number.isInteger(normalized.score) &&
    normalized.score >= recordProfile.scoreMin &&
    normalized.score <= recordProfile.scoreMax
  ) {
    return;
  }

  errors.push({
    code: "RECORD_SCORE_INVALID",
    message: `Record score must be an integer between ${recordProfile.scoreMin} and ${recordProfile.scoreMax}`
  });
}

function validateRecordFeaturedField({ input, normalized, partial, errors }) {
  if (partial && input?.featured === undefined) {
    return;
  }

  if (normalized.featured === undefined) {
    if (!partial) {
      normalized.featured = false;
    }
    return;
  }

  if (normalized.featured === "__INVALID__" || typeof normalized.featured !== "boolean") {
    errors.push({
      code: "RECORD_FEATURED_INVALID",
      message: "Record featured value must be boolean"
    });
  }
}

function validateRecordPublishedOnField({ input, normalized, partial, errors }) {
  if (partial && input?.publishedOn === undefined) {
    return;
  }

  if (normalized.publishedOn === "__INVALID__") {
    errors.push({
      code: "RECORD_PUBLISHED_ON_INVALID",
      message: "Record publishedOn must be null or an ISO date (YYYY-MM-DD)"
    });
    return;
  }

  if (normalized.publishedOn !== null && !isIsoDateString(normalized.publishedOn)) {
    errors.push({
      code: "RECORD_PUBLISHED_ON_INVALID",
      message: "Record publishedOn must be null or an ISO date (YYYY-MM-DD)"
    });
  }
}

function validateRecordNoteIdsField({ input, normalized, partial, errors }) {
  if (partial && input?.noteIds === undefined) {
    return;
  }

  if (normalized.noteIds === undefined) {
    if (!partial) {
      normalized.noteIds = [];
    }
    return;
  }

  if (normalized.noteIds === "__INVALID__") {
    errors.push({
      code: "RECORD_NOTE_IDS_INVALID",
      message: "Record noteIds must be an array of string ids"
    });
  }
}

export function validateRecordInput(input, options = {}, profile = null) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      value: normalizeRecordInput({}),
      errors: [
        {
          code: "RECORD_PAYLOAD_INVALID",
          message: "Record payload must be an object"
        }
      ]
    };
  }

  const partial = options.partial === true;
  const recordProfile = resolveRecordValidationProfile(profile);
  const normalized = normalizeRecordInput(input ?? {});
  const errors = [];
  addUnknownRecordFieldError(input, errors);
  const validationContext = {
    input,
    normalized,
    partial,
    recordProfile,
    errors
  };
  validateRecordTitleField(validationContext);
  validateRecordStatusField(validationContext);
  validateRecordScoreField(validationContext);
  validateRecordFeaturedField(validationContext);
  validateRecordPublishedOnField(validationContext);
  validateRecordNoteIdsField(validationContext);

  return {
    ok: errors.length === 0,
    value: normalized,
    errors
  };
}

export function validateRecordCrossFieldConstraints(record) {
  if (record.status === "published" && record.publishedOn === null) {
    return {
      code: "RECORD_PUBLISHED_ON_REQUIRED_FOR_PUBLISHED",
      message: "Record publishedOn is required when status is published"
    };
  }

  return null;
}

export function nextRecordId(state) {
  const id = `rec-${String(state.nextRecordNumber).padStart(3, "0")}`;
  state.nextRecordNumber += 1;
  return id;
}

export function normalizeNoteCategory(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

export function normalizeNoteLabel(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

export function normalizeNoteLabels(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    return "__INVALID__";
  }

  const labels = [];
  for (const item of value) {
    if (typeof item !== "string") {
      return "__INVALID__";
    }

    const normalized = normalizeNoteLabel(item);
    if (normalized.length > 0 && !labels.includes(normalized)) {
      labels.push(normalized);
    }
  }

  return labels;
}

export function normalizeRecordReferenceId(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  return "__INVALID__";
}

export function normalizeNoteInput(input, profile = null) {
  const rawPriority = input?.priority;
  const parsedPriority =
    typeof rawPriority === "string" && rawPriority.trim().length > 0
      ? Number.parseInt(rawPriority, 10)
      : Number(rawPriority);

  return {
    title: typeof input?.title === "string" ? input.title.trim() : "",
    category: normalizeNoteCategory(input?.category),
    labels: normalizeNoteLabels(input?.labels),
    priority: Number.isFinite(parsedPriority) ? parsedPriority : Number.NaN,
    pinned:
      input?.pinned === undefined
        ? undefined
        : typeof input.pinned === "boolean"
          ? input.pinned
          : "__INVALID__",
    dueDate:
      input?.dueDate === null || input?.dueDate === undefined
        ? null
        : typeof input.dueDate === "string"
          ? input.dueDate.trim() || null
          : "__INVALID__",
    recordId: normalizeRecordReferenceId(input?.recordId)
  };
}


export { NOTE_INPUT_FIELDS, resolveNoteValidationProfile, resolveRecordValidationProfile };
