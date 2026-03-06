import { useCallback } from "react";
import {
  buildEditCollectionFormState,
  createDefaultCollectionFilterState,
  createDefaultCollectionFormState,
  resolveCollectionFilterFieldConfigs
} from "../../domain-helpers.js";
import {
  buildInlineCreateDraft as buildInlineCreateDraftState,
  createDefaultInlineCreateState,
  deleteCollectionItemMutation,
  hydrateInlineCreateReferenceOptions as hydrateInlineCreateReferenceOptionsState,
  normalizeRouteFilterArrayValue,
  normalizeRouteFilterStringValue,
  submitCollectionFormMutation,
  submitInlineCreateMutation
} from "../../domain-runtime-helpers.js";

function useCollectionSelectionHandlers({
  setActiveCollectionId,
  setCollectionFilterState,
  setCollectionFormState,
  onCollectionRouteSelectionChange
}) {
  const handleSelectCollection = useCallback(
    (collectionId) => {
      setActiveCollectionId(collectionId);
      setCollectionFilterState(createDefaultCollectionFilterState(collectionId, null));
      setCollectionFormState(createDefaultCollectionFormState(collectionId, null));

      if (typeof onCollectionRouteSelectionChange === "function") {
        onCollectionRouteSelectionChange({ collectionId });
      }
    },
    [
      onCollectionRouteSelectionChange,
      setActiveCollectionId,
      setCollectionFilterState,
      setCollectionFormState
    ]
  );

  return {
    handleSelectCollection
  };
}

function useCollectionFilterHandlers({
  activeCollectionId,
  collectionSchema,
  setCollectionFilterState,
  onCollectionRouteFilterChange
}) {
  const handleCollectionFilterChange = useCallback(
    (field, value) => {
      setCollectionFilterState((previous) => ({
        ...previous,
        [field]: value
      }));

      if (typeof onCollectionRouteFilterChange !== "function") {
        return;
      }

      const filterConfigs = resolveCollectionFilterFieldConfigs(
        collectionSchema,
        activeCollectionId
      );
      const filterConfig = filterConfigs.find((config) => config.fieldId === field);
      if (!filterConfig) {
        return;
      }

      onCollectionRouteFilterChange({
        collectionId: activeCollectionId,
        fieldId: field,
        queryKey: filterConfig.queryKey,
        value: filterConfig.multi
          ? normalizeRouteFilterArrayValue(value)
          : normalizeRouteFilterStringValue(value),
        multi: filterConfig.multi
      });
    },
    [
      activeCollectionId,
      collectionSchema,
      onCollectionRouteFilterChange,
      setCollectionFilterState
    ]
  );

  const handleClearCollectionFilters = useCallback(() => {
    const clearedFilterState = createDefaultCollectionFilterState(
      activeCollectionId,
      collectionSchema
    );
    setCollectionFilterState(clearedFilterState);

    if (typeof onCollectionRouteFilterChange !== "function") {
      return;
    }

    const filterConfigs = resolveCollectionFilterFieldConfigs(
      collectionSchema,
      activeCollectionId
    );
    for (const filterConfig of filterConfigs) {
      onCollectionRouteFilterChange({
        collectionId: activeCollectionId,
        fieldId: filterConfig.fieldId,
        queryKey: filterConfig.queryKey,
        value: filterConfig.multi ? [] : "",
        multi: filterConfig.multi
      });
    }
  }, [
    activeCollectionId,
    collectionSchema,
    onCollectionRouteFilterChange,
    setCollectionFilterState
  ]);

  return {
    handleCollectionFilterChange,
    handleClearCollectionFilters
  };
}

function useCollectionFormHandlers({
  activeCollectionId,
  collectionSchema,
  setCollectionFormState
}) {
  const handleCollectionFormChange = useCallback((field, value) => {
    setCollectionFormState((previous) => ({
      ...previous,
      [field]: value,
      errorMessage: null,
      successMessage: null,
      errorActions: []
    }));
  }, [setCollectionFormState]);

  const handleEditCollectionItem = useCallback(
    (item) => {
      setCollectionFormState(
        buildEditCollectionFormState(activeCollectionId, item, collectionSchema)
      );
    },
    [activeCollectionId, collectionSchema, setCollectionFormState]
  );

  const handleResetCollectionForm = useCallback(() => {
    setCollectionFormState(
      createDefaultCollectionFormState(activeCollectionId, collectionSchema)
    );
  }, [activeCollectionId, collectionSchema, setCollectionFormState]);

  return {
    handleCollectionFormChange,
    handleEditCollectionItem,
    handleResetCollectionForm
  };
}

function useInlineCreateHandlers({
  api,
  collectionFormState,
  inlineCreateState,
  setInlineCreateState,
  setReferenceOptionsState,
  setCollectionFormState,
  setCollectionItemsReloadToken
}) {
  const handleInlineCreateReference = useCallback(
    async (field) => {
      if (!field || typeof field !== "object" || typeof field.collectionId !== "string") {
        return;
      }
      if (field.referenceUi?.inlineCreate !== true) {
        return;
      }

      const targetCollectionId = field.collectionId;
      setInlineCreateState({
        open: true,
        saving: false,
        loadingSchema: true,
        errorMessage: null,
        sourceField: field,
        targetCollectionId,
        targetCollectionLabel: targetCollectionId,
        collectionSchema: null,
        formState: {}
      });

      try {
        const schemaPayload = await api.readCollectionSchema({
          collectionId: targetCollectionId
        });
        if (!schemaPayload?.ok || !schemaPayload?.collection) {
          setInlineCreateState((previous) => ({
            ...previous,
            loadingSchema: false,
            errorMessage: schemaPayload?.error?.message ?? "Failed to load inline-create schema"
          }));
          return;
        }

        const targetCollectionSchema = schemaPayload.collection;
        await hydrateInlineCreateReferenceOptionsState({
          api,
          targetCollectionId,
          targetCollectionSchema,
          setReferenceOptionsState
        });
        const draft = buildInlineCreateDraftState({
          collectionFormState,
          sourceField: field,
          targetCollectionId,
          targetCollectionSchema
        });
        setInlineCreateState({
          open: true,
          saving: false,
          loadingSchema: false,
          errorMessage: null,
          sourceField: field,
          targetCollectionId,
          targetCollectionLabel:
            typeof targetCollectionSchema.label === "string" &&
            targetCollectionSchema.label.length > 0
              ? targetCollectionSchema.label
              : targetCollectionId,
          collectionSchema: targetCollectionSchema,
          formState: draft
        });
      } catch (error) {
        setInlineCreateState((previous) => ({
          ...previous,
          loadingSchema: false,
          errorMessage: error?.message ?? "Failed to load inline-create schema"
        }));
      }
    },
    [api, collectionFormState, setInlineCreateState, setReferenceOptionsState]
  );

  const handleInlineCreateFormChange = useCallback((fieldId, value) => {
    setInlineCreateState((previous) => ({
      ...previous,
      errorMessage: null,
      formState: {
        ...(previous.formState ?? {}),
        [fieldId]: value
      }
    }));
  }, [setInlineCreateState]);

  const handleCloseInlineCreate = useCallback(() => {
    setInlineCreateState(createDefaultInlineCreateState());
  }, [setInlineCreateState]);

  const handleSubmitInlineCreate = useCallback(async () => {
    await submitInlineCreateMutation({
      api,
      inlineCreateState,
      setInlineCreateState,
      setReferenceOptionsState,
      setCollectionFormState,
      setCollectionItemsReloadToken
    });
  }, [
    api,
    inlineCreateState,
    setInlineCreateState,
    setReferenceOptionsState,
    setCollectionFormState,
    setCollectionItemsReloadToken
  ]);

  return {
    handleInlineCreateReference,
    handleInlineCreateFormChange,
    handleCloseInlineCreate,
    handleSubmitInlineCreate
  };
}

function useCollectionMutationHandlers({
  api,
  activeCollection,
  activeCollectionId,
  activeCollectionUnavailableMessage,
  collectionFormState,
  collectionSchema,
  isActiveCollectionAvailable,
  onCollectionMutation,
  setCollectionFormState,
  setCollectionItemsReloadToken
}) {
  const handleSubmitCollectionForm = useCallback(async () => {
    await submitCollectionFormMutation({
      activeCollection,
      activeCollectionId,
      activeCollectionUnavailableMessage,
      api,
      collectionFormState,
      collectionSchema,
      isActiveCollectionAvailable,
      onCollectionMutation,
      setCollectionFormState,
      setCollectionItemsReloadToken
    });
  }, [
    activeCollection,
    activeCollectionId,
    activeCollectionUnavailableMessage,
    api,
    collectionSchema,
    collectionFormState,
    isActiveCollectionAvailable,
    onCollectionMutation,
    setCollectionFormState,
    setCollectionItemsReloadToken
  ]);

  const handleDeleteCollectionItem = useCallback(
    async (itemId) => {
      await deleteCollectionItemMutation({
        activeCollection,
        activeCollectionId,
        activeCollectionUnavailableMessage,
        api,
        collectionSchema,
        isActiveCollectionAvailable,
        itemId,
        onCollectionMutation,
        setCollectionFormState,
        setCollectionItemsReloadToken
      });
    },
    [
      activeCollection,
      activeCollectionId,
      activeCollectionUnavailableMessage,
      api,
      collectionSchema,
      isActiveCollectionAvailable,
      onCollectionMutation,
      setCollectionFormState,
      setCollectionItemsReloadToken
    ]
  );

  return {
    handleSubmitCollectionForm,
    handleDeleteCollectionItem
  };
}

function useCollectionUtilityHandlers({
  onCollectionErrorAction,
  setCollectionItemsReloadToken
}) {
  const handleRunCollectionErrorAction = useCallback(
    (action) => {
      if (!action || typeof action !== "object") {
        return;
      }
      if (typeof onCollectionErrorAction !== "function") {
        return;
      }

      onCollectionErrorAction(action);
    },
    [onCollectionErrorAction]
  );

  const handleReloadCollectionItems = useCallback(() => {
    setCollectionItemsReloadToken((value) => value + 1);
  }, [setCollectionItemsReloadToken]);

  return {
    handleRunCollectionErrorAction,
    handleReloadCollectionItems
  };
}

function useCollectionsDomainHandlers({
  api,
  activeCollection,
  activeCollectionId,
  activeCollectionUnavailableMessage,
  collectionFormState,
  collectionSchemaState,
  inlineCreateState,
  isActiveCollectionAvailable,
  onCollectionErrorAction,
  onCollectionMutation,
  onCollectionRouteFilterChange,
  onCollectionRouteSelectionChange,
  setActiveCollectionId,
  setCollectionFilterState,
  setCollectionFormState,
  setCollectionItemsReloadToken,
  setInlineCreateState,
  setReferenceOptionsState
}) {
  const collectionSelectionHandlers = useCollectionSelectionHandlers({
    setActiveCollectionId,
    setCollectionFilterState,
    setCollectionFormState,
    onCollectionRouteSelectionChange
  });
  const collectionFilterHandlers = useCollectionFilterHandlers({
    activeCollectionId,
    collectionSchema: collectionSchemaState.collection,
    setCollectionFilterState,
    onCollectionRouteFilterChange
  });
  const collectionFormHandlers = useCollectionFormHandlers({
    activeCollectionId,
    collectionSchema: collectionSchemaState.collection,
    setCollectionFormState
  });
  const inlineCreateHandlers = useInlineCreateHandlers({
    api,
    collectionFormState,
    inlineCreateState,
    setInlineCreateState,
    setReferenceOptionsState,
    setCollectionFormState,
    setCollectionItemsReloadToken
  });
  const collectionMutationHandlers = useCollectionMutationHandlers({
    api,
    activeCollection,
    activeCollectionId,
    activeCollectionUnavailableMessage,
    collectionFormState,
    collectionSchema: collectionSchemaState.collection,
    isActiveCollectionAvailable,
    onCollectionMutation,
    setCollectionFormState,
    setCollectionItemsReloadToken
  });
  const utilityHandlers = useCollectionUtilityHandlers({
    onCollectionErrorAction,
    setCollectionItemsReloadToken
  });

  return {
    ...collectionSelectionHandlers,
    ...collectionFilterHandlers,
    ...collectionFormHandlers,
    ...inlineCreateHandlers,
    ...collectionMutationHandlers,
    ...utilityHandlers
  };
}

export { useCollectionsDomainHandlers };
