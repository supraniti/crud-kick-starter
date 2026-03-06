import {
  COLLECTION_PAGE_LIMIT,
  DEFAULT_COLLECTION_ID
} from "./domain-helpers/parts/00-constants.js";
import {
  resolveCollectionSchemaFields,
  resolveEditableCollectionFields,
  resolveCollectionFilterFieldConfigs,
  resolveReferenceCollectionIds
} from "./domain-helpers/parts/01-schema-and-filter-config.js";
import {
  buildCollectionListOptions,
  buildCollectionMutationPayload,
  buildEditCollectionFormState,
  createDefaultCollectionFilterState,
  createDefaultCollectionFormState
} from "./domain-helpers/parts/02-form-and-payload.js";
import {
  buildCollectionUnavailableMessage,
  buildModuleCollectionMap,
  getCollectionEntityLabel,
  resolveActiveModuleIdFromPath,
  resolveModuleScopedCollections,
  resolvePreferredActiveCollectionId,
  singularizeCollectionLabel
} from "./domain-helpers/parts/03-module-scope-and-labels.js";

export {
  COLLECTION_PAGE_LIMIT,
  DEFAULT_COLLECTION_ID,
  buildModuleCollectionMap,
  buildCollectionListOptions,
  buildCollectionMutationPayload,
  buildCollectionUnavailableMessage,
  buildEditCollectionFormState,
  createDefaultCollectionFilterState,
  createDefaultCollectionFormState,
  getCollectionEntityLabel,
  resolveActiveModuleIdFromPath,
  resolveCollectionFilterFieldConfigs,
  resolveCollectionSchemaFields,
  resolveEditableCollectionFields,
  resolveModuleScopedCollections,
  resolvePreferredActiveCollectionId,
  resolveReferenceCollectionIds,
  singularizeCollectionLabel
};
