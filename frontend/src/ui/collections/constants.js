const FALLBACK_RECORD_STATUS_OPTIONS = ["draft", "review", "published"];
const FALLBACK_NOTE_CATEGORY_OPTIONS = ["general", "tech", "ops"];
const FALLBACK_NOTE_LABEL_OPTIONS = ["action", "ops", "ui", "backend", "release"];
const FALLBACK_RECORD_SCORE_RANGE = {
  min: 0,
  max: 100
};
const FALLBACK_NOTE_PRIORITY_RANGE = {
  min: 1,
  max: 5
};

function getCollectionEntityLabel(collectionId) {
  return collectionId === "notes" ? "note" : "record";
}

function normalizeMultiSelectValue(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export {
  FALLBACK_NOTE_CATEGORY_OPTIONS,
  FALLBACK_NOTE_LABEL_OPTIONS,
  FALLBACK_NOTE_PRIORITY_RANGE,
  FALLBACK_RECORD_SCORE_RANGE,
  FALLBACK_RECORD_STATUS_OPTIONS,
  getCollectionEntityLabel,
  normalizeMultiSelectValue
};
