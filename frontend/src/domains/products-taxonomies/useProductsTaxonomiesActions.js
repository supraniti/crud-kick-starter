import { useCallback } from "react";
import {
  createRelationEditorState
} from "./domain-helpers.js";

function setTagEditorErrorState(setRelationEditor, errorMessage) {
  setRelationEditor((previous) => ({
    ...previous,
    saving: false,
    errorMessage
  }));
}

function setTagEditorSafeguardState(setRelationEditor, payload) {
  setRelationEditor((previous) => ({
    ...previous,
    saving: false,
    safeguard: payload?.safeguard ?? null,
    errorMessage: payload?.error?.message ?? "Safeguard confirmation required"
  }));
}

function useRunSaveProductTags({
  api,
  handleCloseTagEditor,
  onDomainMutation,
  relationEditor,
  setProductsReloadToken,
  setRelationEditor,
  setTagsReloadToken
}) {
  return useCallback(
    async (approveNewTag) => {
      if (!relationEditor.productId) {
        return;
      }

      setRelationEditor((previous) => ({
        ...previous,
        saving: true,
        errorMessage: null
      }));

      try {
        const payload = await api.updateProductTags({
          productId: relationEditor.productId,
          tagIds: relationEditor.selectedTagIds,
          newTagLabel: relationEditor.newTagLabel,
          approveNewTag
        });

        if (payload?.ok) {
          handleCloseTagEditor();
          setProductsReloadToken((value) => value + 1);
          setTagsReloadToken((value) => value + 1);
          if (typeof onDomainMutation === "function") {
            onDomainMutation();
          }
          return;
        }

        if (payload?.error?.code === "SAFEGUARD_CONFIRMATION_REQUIRED") {
          setTagEditorSafeguardState(setRelationEditor, payload);
          return;
        }

        setTagEditorErrorState(
          setRelationEditor,
          payload?.error?.message ?? "Failed to save tags"
        );
      } catch (error) {
        setTagEditorErrorState(
          setRelationEditor,
          error?.message ?? "Failed to save tags"
        );
      }
    },
    [
      api,
      handleCloseTagEditor,
      onDomainMutation,
      relationEditor.newTagLabel,
      relationEditor.productId,
      relationEditor.selectedTagIds,
      setProductsReloadToken,
      setRelationEditor,
      setTagsReloadToken
    ]
  );
}

function useTagEditorActions({
  api,
  onDomainMutation,
  productsState,
  relationEditor,
  setRelationEditor,
  setProductsReloadToken,
  setTagsReloadToken
}) {
  const handleOpenTagEditor = useCallback(
    (productId) => {
      const product = productsState.items.find((item) => item.id === productId);
      if (!product) {
        return;
      }

      setRelationEditor({
        open: true,
        productId,
        selectedTagIds: [...(product.tagIds ?? [])],
        newTagLabel: "",
        saving: false,
        errorMessage: null,
        safeguard: null
      });
    },
    [productsState.items, setRelationEditor]
  );

  const handleCloseTagEditor = useCallback(() => {
    setRelationEditor(createRelationEditorState());
  }, [setRelationEditor]);

  const handleToggleEditorTag = useCallback(
    (tagId) => {
      setRelationEditor((previous) => {
        const exists = previous.selectedTagIds.includes(tagId);
        return {
          ...previous,
          selectedTagIds: exists
            ? previous.selectedTagIds.filter((id) => id !== tagId)
            : [...previous.selectedTagIds, tagId]
        };
      });
    },
    [setRelationEditor]
  );

  const handleChangeNewTag = useCallback(
    (value) => {
      setRelationEditor((previous) => ({
        ...previous,
        newTagLabel: value,
        safeguard: null,
        errorMessage: null
      }));
    },
    [setRelationEditor]
  );

  const runSaveProductTags = useRunSaveProductTags({
    api,
    handleCloseTagEditor,
    onDomainMutation,
    relationEditor,
    setProductsReloadToken,
    setRelationEditor,
    setTagsReloadToken
  });

  const handleSaveProductTags = useCallback(() => {
    runSaveProductTags(false);
  }, [runSaveProductTags]);

  const handleConfirmProductTags = useCallback(() => {
    runSaveProductTags(true);
  }, [runSaveProductTags]);

  return {
    handleOpenTagEditor,
    handleCloseTagEditor,
    handleToggleEditorTag,
    handleChangeNewTag,
    handleSaveProductTags,
    handleConfirmProductTags
  };
}

function useTaxonomyDeleteActions({
  api,
  onDomainMutation,
  taxonomyDeleteState,
  setTaxonomyDeleteState,
  setProductsReloadToken,
  setTagsReloadToken
}) {
  const handleToggleDeleteTagSelection = useCallback(
    (tagId) => {
      setTaxonomyDeleteState((previous) => {
        const exists = previous.selectedTagIds.includes(tagId);
        return {
          ...previous,
          selectedTagIds: exists
            ? previous.selectedTagIds.filter((id) => id !== tagId)
            : [...previous.selectedTagIds, tagId],
          deleteResult: null
        };
      });
    },
    [setTaxonomyDeleteState]
  );

  const handleAnalyzeDeleteImpact = useCallback(async () => {
    setTaxonomyDeleteState((previous) => ({
      ...previous,
      loading: true,
      errorMessage: null,
      deleteResult: null
    }));

    try {
      const payload = await api.analyzeTagDelete({
        tagIds: taxonomyDeleteState.selectedTagIds
      });

      setTaxonomyDeleteState((previous) => ({
        ...previous,
        loading: false,
        impact: payload,
        errorMessage: null
      }));
    } catch (error) {
      setTaxonomyDeleteState((previous) => ({
        ...previous,
        loading: false,
        errorMessage: error?.message ?? "Failed to analyze impact"
      }));
    }
  }, [api, setTaxonomyDeleteState, taxonomyDeleteState.selectedTagIds]);

  const handleApproveDeleteTags = useCallback(async () => {
    setTaxonomyDeleteState((previous) => ({
      ...previous,
      deleting: true,
      errorMessage: null
    }));

    try {
      const payload = await api.deleteTags({
        tagIds: taxonomyDeleteState.selectedTagIds,
        approved: true
      });

      if (!payload?.ok) {
        setTaxonomyDeleteState((previous) => ({
          ...previous,
          deleting: false,
          errorMessage: payload?.error?.message ?? "Failed to delete tags"
        }));
        return;
      }

      setTaxonomyDeleteState((previous) => ({
        ...previous,
        deleting: false,
        selectedTagIds: [],
        impact: null,
        deleteResult: payload,
        errorMessage: null
      }));
      setProductsReloadToken((value) => value + 1);
      setTagsReloadToken((value) => value + 1);
      if (typeof onDomainMutation === "function") {
        onDomainMutation();
      }
    } catch (error) {
      setTaxonomyDeleteState((previous) => ({
        ...previous,
        deleting: false,
        errorMessage: error?.message ?? "Failed to delete tags"
      }));
    }
  }, [
    api,
    onDomainMutation,
    setProductsReloadToken,
    setTagsReloadToken,
    setTaxonomyDeleteState,
    taxonomyDeleteState.selectedTagIds
  ]);

  const handleClearTaxonomyState = useCallback(() => {
    setTaxonomyDeleteState((previous) => ({
      ...previous,
      impact: null,
      errorMessage: null,
      deleteResult: null
    }));
  }, [setTaxonomyDeleteState]);

  return {
    handleToggleDeleteTagSelection,
    handleAnalyzeDeleteImpact,
    handleApproveDeleteTags,
    handleClearTaxonomyState
  };
}

function useProductsTaxonomiesActions(params) {
  const handlePreviewSafeguard = useCallback(async () => {
    params.setSafeguardState({
      loading: true,
      errorMessage: null,
      payload: null
    });

    try {
      const payload = await params.api.previewSafeguard({
        action: "create-tag",
        value: params.safeguardInput
      });

      params.setSafeguardState({
        loading: false,
        errorMessage: null,
        payload: payload?.safeguard ?? null
      });
    } catch (error) {
      params.setSafeguardState({
        loading: false,
        errorMessage: error?.message ?? "Failed to evaluate safeguard",
        payload: null
      });
    }
  }, [params.api, params.safeguardInput, params.setSafeguardState]);

  return {
    handlePreviewSafeguard,
    ...useTagEditorActions(params),
    ...useTaxonomyDeleteActions(params)
  };
}

export { useProductsTaxonomiesActions };
