import {
  isMutableCollectionFieldType,
  isQueryableCollectionFieldType
} from "../../../collection-field-catalog.mjs";

const DEFAULT_REFERENCE_COLLECTION_ID = "records";
const REFERENCE_DELETE_POLICY_ALLOWED_VALUES = new Set(["restrict", "nullify"]);
const QUERY_SUPPORTED_FIELD_TYPES = Object.freeze({
  has(type) {
    return isQueryableCollectionFieldType(type);
  }
});
const MUTABLE_SUPPORTED_FIELD_TYPES = Object.freeze({
  has(type) {
    return isMutableCollectionFieldType(type);
  }
});

export {
  DEFAULT_REFERENCE_COLLECTION_ID,
  MUTABLE_SUPPORTED_FIELD_TYPES,
  QUERY_SUPPORTED_FIELD_TYPES,
  REFERENCE_DELETE_POLICY_ALLOWED_VALUES
};
