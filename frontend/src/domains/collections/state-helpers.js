import { COLLECTION_PAGE_LIMIT } from "./domain-helpers.js";

function createDefaultCollectionsState() {
  return {
    loading: false,
    errorMessage: null,
    items: []
  };
}

function createDefaultCollectionSchemaState() {
  return {
    loading: false,
    errorMessage: null,
    collection: null
  };
}

function createDefaultCollectionItemsState() {
  return {
    loading: false,
    errorMessage: null,
    items: [],
    meta: {
      total: 0,
      offset: 0,
      limit: COLLECTION_PAGE_LIMIT
    }
  };
}

function createDefaultCollectionOptionsState() {
  return {
    loading: false,
    errorMessage: null,
    items: []
  };
}

function createDefaultCollectionReferenceOptionsState() {
  return {};
}

export {
  createDefaultCollectionItemsState,
  createDefaultCollectionReferenceOptionsState,
  createDefaultCollectionOptionsState,
  createDefaultCollectionSchemaState,
  createDefaultCollectionsState
};
