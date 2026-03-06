import { codeFor, codeForField } from "./input-validation-helpers.mjs";

function resolvePrimaryFieldId(definition) {
  return typeof definition?.primaryField === "string" && definition.primaryField.length > 0
    ? definition.primaryField
    : "title";
}

function readPrimaryFieldValue(item, definition) {
  const primaryFieldId = resolvePrimaryFieldId(definition);
  const value = item?.[primaryFieldId];
  return typeof value === "string" ? value : "";
}

function readPrimaryFieldValueForSearch(item, definition) {
  return readPrimaryFieldValue(item, definition).trim().toLowerCase();
}

function resolvePrimaryFieldConflictCode(definition) {
  const primaryFieldId = resolvePrimaryFieldId(definition);
  return primaryFieldId === "title"
    ? codeFor(definition, "TITLE_CONFLICT")
    : codeForField(definition, primaryFieldId, "CONFLICT");
}

export {
  readPrimaryFieldValue,
  readPrimaryFieldValueForSearch,
  resolvePrimaryFieldConflictCode,
  resolvePrimaryFieldId
};
