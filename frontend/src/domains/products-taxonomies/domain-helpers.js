const PRODUCTS_MODULE_ID = "products";
const PRODUCTS_PAGE_LIMIT = 50;

function createDefaultCategoriesState() {
  return {
    loading: false,
    errorMessage: null,
    items: []
  };
}

function createDefaultTagsState() {
  return {
    loading: false,
    errorMessage: null,
    items: []
  };
}

function createProductsState() {
  return {
    loading: false,
    errorMessage: null,
    items: [],
    meta: {
      total: 0,
      offset: 0,
      limit: PRODUCTS_PAGE_LIMIT
    }
  };
}

function createDefaultSafeguardState() {
  return {
    loading: false,
    errorMessage: null,
    payload: null
  };
}

function createRelationEditorState() {
  return {
    open: false,
    productId: null,
    selectedTagIds: [],
    newTagLabel: "",
    saving: false,
    errorMessage: null,
    safeguard: null
  };
}

function createDefaultTaxonomyDeleteState() {
  return {
    selectedTagIds: [],
    loading: false,
    deleting: false,
    errorMessage: null,
    impact: null,
    deleteResult: null
  };
}

export {
  PRODUCTS_MODULE_ID,
  PRODUCTS_PAGE_LIMIT,
  createDefaultCategoriesState,
  createDefaultSafeguardState,
  createDefaultTagsState,
  createDefaultTaxonomyDeleteState,
  createProductsState,
  createRelationEditorState
};
