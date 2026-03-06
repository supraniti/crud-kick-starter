import { useCollectionsDomainDerivedState } from "./useCollectionsDomain/parts/01-derived-state.js";
import { useCollectionsDomainLoadersAndScopeEffects } from "./useCollectionsDomain/parts/02-loaders-and-scope-effects.js";
import { useCollectionsDomainFilterAndFormEffects } from "./useCollectionsDomain/parts/03-filter-form-effects.js";
import { useCollectionsDomainHandlers } from "./useCollectionsDomain/parts/04-domain-handlers.js";
import { useCollectionsDomainState } from "./useCollectionsDomain/parts/05-domain-state.js";
import { buildCollectionsDomainResult } from "./useCollectionsDomain/parts/06-domain-result.js";

function useCollectionsDomain({
  api, isAuthenticated, enabled = false, isCollectionsRouteActive, moduleRuntimeItems,
  moduleRuntimeReloadToken, onCollectionMutation, onCollectionErrorAction, routeState,
  onCollectionRouteFilterChange, onCollectionRouteSelectionChange
}) {
  const {
    collectionsState, setCollectionsState, collectionSchemaState, setCollectionSchemaState,
    collectionItemsState, setCollectionItemsState, referenceOptionsState, setReferenceOptionsState,
    moduleCollectionMap, setModuleCollectionMap, collectionScopeRef, activeCollectionId,
    setActiveCollectionId, collectionItemsReloadToken, setCollectionItemsReloadToken,
    collectionFilterState, setCollectionFilterState, collectionFormState, setCollectionFormState,
    inlineCreateState, setInlineCreateState
  } = useCollectionsDomainState();

  const {
    activeModuleId, activeCollection, activeCollectionUnavailableMessage, collectionFilterKey,
    collectionListOptions, collectionScopeKey, isActiveCollectionAvailable, routeCollectionId,
    scopedCollectionsItems, scopedCollectionsState
  } = useCollectionsDomainDerivedState({
    collectionsState, moduleCollectionMap, isCollectionsRouteActive, activeCollectionId,
    collectionFilterState, collectionSchemaState, routeState
  });

  useCollectionsDomainLoadersAndScopeEffects({
    api, enabled, isAuthenticated, moduleRuntimeItems, moduleRuntimeReloadToken, collectionsState,
    setCollectionsState, setModuleCollectionMap, activeCollectionId, activeModuleId,
    collectionScopeKey, collectionScopeRef, isCollectionsRouteActive, moduleCollectionMap,
    scopedCollectionsItems, routeCollectionId, setActiveCollectionId, setCollectionFilterState,
    setCollectionFormState, activeCollectionUnavailableMessage, collectionListOptions,
    collectionFilterKey, collectionItemsReloadToken, isActiveCollectionAvailable,
    collectionSchemaState, collectionFilterState, setCollectionSchemaState,
    setCollectionItemsState, setReferenceOptionsState
  });

  useCollectionsDomainFilterAndFormEffects({
    enabled, isAuthenticated, isCollectionsRouteActive, isActiveCollectionAvailable,
    activeCollectionId, collectionSchemaState, collectionFilterState, collectionFilterKey,
    routeState, setCollectionsState, setCollectionSchemaState, setCollectionItemsState,
    setReferenceOptionsState, setModuleCollectionMap, setActiveCollectionId,
    setCollectionFilterState, setCollectionFormState, setInlineCreateState
  });

  const {
    handleClearCollectionFilters, handleCloseInlineCreate, handleCollectionFilterChange,
    handleCollectionFormChange, handleDeleteCollectionItem, handleEditCollectionItem,
    handleInlineCreateFormChange, handleInlineCreateReference, handleReloadCollectionItems,
    handleResetCollectionForm, handleRunCollectionErrorAction, handleSelectCollection,
    handleSubmitCollectionForm, handleSubmitInlineCreate
  } = useCollectionsDomainHandlers({
    api, activeCollection, activeCollectionId, activeCollectionUnavailableMessage,
    collectionFilterState, collectionFormState, collectionSchemaState, inlineCreateState,
    isActiveCollectionAvailable, onCollectionErrorAction, onCollectionMutation,
    onCollectionRouteFilterChange, onCollectionRouteSelectionChange, setActiveCollectionId,
    setCollectionFilterState, setCollectionFormState, setCollectionItemsReloadToken,
    setInlineCreateState, setReferenceOptionsState
  });

  return buildCollectionsDomainResult({
    scopedCollectionsState, collectionSchemaState, collectionItemsState, referenceOptionsState,
    activeCollectionId, isActiveCollectionAvailable, activeCollectionUnavailableMessage,
    collectionFilterState, collectionFormState, inlineCreateState, handleSelectCollection,
    handleCollectionFilterChange, handleClearCollectionFilters, handleCollectionFormChange,
    handleEditCollectionItem, handleResetCollectionForm, handleSubmitCollectionForm,
    handleDeleteCollectionItem, handleInlineCreateReference, handleInlineCreateFormChange,
    handleCloseInlineCreate, handleSubmitInlineCreate, handleRunCollectionErrorAction,
    handleReloadCollectionItems
  });
}

export { useCollectionsDomain };
