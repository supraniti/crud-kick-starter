import { useEffect, useState } from "react";
import {
  createDefaultCategoriesState,
  createDefaultSafeguardState,
  createDefaultTagsState,
  createDefaultTaxonomyDeleteState,
  createProductsState,
  createRelationEditorState
} from "./domain-helpers.js";
import {
  useCategoriesLoader,
  useProductsLoader,
  useTagsLoader
} from "./useProductsTaxonomiesLoaders.js";
import { useProductsTaxonomiesActions } from "./useProductsTaxonomiesActions.js";

function useProductsTaxonomiesDomain({
  api,
  isAuthenticated,
  enabled = false,
  activeModuleId,
  selectedCategoryIds,
  onDomainMutation
}) {
  const [categoriesState, setCategoriesState] = useState(() =>
    createDefaultCategoriesState()
  );
  const [tagsState, setTagsState] = useState(() => createDefaultTagsState());
  const [productsState, setProductsState] = useState(() => createProductsState());
  const [safeguardInput, setSafeguardInput] = useState("");
  const [safeguardState, setSafeguardState] = useState(() =>
    createDefaultSafeguardState()
  );
  const [relationEditor, setRelationEditor] = useState(() => createRelationEditorState());
  const [taxonomyDeleteState, setTaxonomyDeleteState] = useState(() =>
    createDefaultTaxonomyDeleteState()
  );
  const [productsReloadToken, setProductsReloadToken] = useState(0);
  const [tagsReloadToken, setTagsReloadToken] = useState(0);
  const selectedCategoryKey = selectedCategoryIds.join(",");

  useCategoriesLoader({
    activeModuleId,
    api,
    isAuthenticated: isAuthenticated && enabled,
    setCategoriesState
  });

  useTagsLoader({
    api,
    isAuthenticated: isAuthenticated && enabled,
    setTagsState,
    tagsReloadToken
  });

  useProductsLoader({
    activeModuleId,
    api,
    isAuthenticated: isAuthenticated && enabled,
    productsReloadToken,
    selectedCategoryIds,
    selectedCategoryKey,
    setProductsState
  });

  useEffect(() => {
    if (enabled) {
      return;
    }

    setCategoriesState(createDefaultCategoriesState());
    setTagsState(createDefaultTagsState());
    setProductsState(createProductsState());
    setSafeguardInput("");
    setSafeguardState(createDefaultSafeguardState());
    setRelationEditor(createRelationEditorState());
    setTaxonomyDeleteState(createDefaultTaxonomyDeleteState());
  }, [enabled]);

  const actions = useProductsTaxonomiesActions({
    api,
    onDomainMutation,
    productsState,
    safeguardInput,
    relationEditor,
    taxonomyDeleteState,
    setSafeguardState,
    setRelationEditor,
    setTaxonomyDeleteState,
    setProductsReloadToken,
    setTagsReloadToken
  });

  return {
    categoriesState,
    tagsState,
    productsState,
    safeguardInput,
    setSafeguardInput,
    safeguardState,
    relationEditor,
    taxonomyDeleteState,
    ...actions
  };
}

export { useProductsTaxonomiesDomain };
