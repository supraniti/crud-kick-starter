import { useMemo } from "react";
import {
  buildCollectionListOptions,
  buildCollectionUnavailableMessage,
  resolveActiveModuleIdFromPath,
  resolveModuleScopedCollections
} from "../../domain-helpers.js";
import { buildCollectionFilterConfigSignature } from "../../domain-runtime-helpers.js";

function useCollectionsDomainDerivedState({
  collectionsState,
  moduleCollectionMap,
  isCollectionsRouteActive,
  activeCollectionId,
  collectionFilterState,
  collectionSchemaState,
  routeState
}) {
  const activeModuleId = resolveActiveModuleIdFromPath(window.location.pathname);
  const scopedCollectionsItems = useMemo(
    () =>
      isCollectionsRouteActive
        ? resolveModuleScopedCollections(
            collectionsState.items,
            activeModuleId,
            moduleCollectionMap
          )
        : [],
    [activeModuleId, collectionsState.items, isCollectionsRouteActive, moduleCollectionMap]
  );
  const scopedCollectionsState = useMemo(
    () => ({
      ...collectionsState,
      items: scopedCollectionsItems
    }),
    [collectionsState, scopedCollectionsItems]
  );
  const collectionScopeKey = useMemo(
    () =>
      `${activeModuleId}:${scopedCollectionsItems
        .map((collection) => collection.id)
        .join(",")}`,
    [activeModuleId, scopedCollectionsItems]
  );
  const collectionFilterKey = JSON.stringify(collectionFilterState);
  const stableCollectionFilterState = useMemo(
    () => collectionFilterState,
    [collectionFilterKey]
  );
  const hasActiveCollectionFieldFilters = useMemo(
    () =>
      Object.entries(stableCollectionFilterState).some(([fieldId, value]) => {
        if (fieldId === "search") {
          return false;
        }

        if (Array.isArray(value)) {
          return value.length > 0;
        }

        if (typeof value === "string") {
          return value.trim().length > 0;
        }

        return false;
      }),
    [collectionFilterKey, stableCollectionFilterState]
  );
  const filterSchemaForListOptions = hasActiveCollectionFieldFilters
    ? collectionSchemaState.collection
    : null;
  const filterSchemaForListOptionsSignature = useMemo(
    () =>
      hasActiveCollectionFieldFilters
        ? buildCollectionFilterConfigSignature(filterSchemaForListOptions, activeCollectionId)
        : "",
    [activeCollectionId, hasActiveCollectionFieldFilters, filterSchemaForListOptions]
  );
  const collectionListOptions = useMemo(
    () => {
      const listSchema = hasActiveCollectionFieldFilters ? filterSchemaForListOptions : null;
      return buildCollectionListOptions(
        activeCollectionId,
        stableCollectionFilterState,
        listSchema
      );
    },
    [
      activeCollectionId,
      collectionFilterKey,
      filterSchemaForListOptionsSignature,
      hasActiveCollectionFieldFilters,
      stableCollectionFilterState
    ]
  );
  const activeCollection = useMemo(
    () =>
      scopedCollectionsItems.find((collection) => collection.id === activeCollectionId) ?? null,
    [activeCollectionId, scopedCollectionsItems]
  );
  const isActiveCollectionAvailable = activeCollection !== null;
  const activeCollectionUnavailableMessage = useMemo(
    () => buildCollectionUnavailableMessage(activeCollectionId),
    [activeCollectionId]
  );
  const routeCollectionId = useMemo(() => {
    if (!routeState || typeof routeState !== "object" || Array.isArray(routeState)) {
      return "";
    }
    return typeof routeState.collectionId === "string" ? routeState.collectionId : "";
  }, [routeState]);

  return {
    activeModuleId,
    activeCollection,
    activeCollectionUnavailableMessage,
    collectionFilterKey,
    collectionListOptions,
    collectionScopeKey,
    hasActiveCollectionFieldFilters,
    isActiveCollectionAvailable,
    routeCollectionId,
    scopedCollectionsItems,
    scopedCollectionsState
  };
}

export { useCollectionsDomainDerivedState };
