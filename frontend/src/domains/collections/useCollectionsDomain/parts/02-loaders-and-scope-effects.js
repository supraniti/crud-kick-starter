import { useEffect } from "react";
import {
  createDefaultCollectionFilterState,
  createDefaultCollectionFormState,
  resolvePreferredActiveCollectionId
} from "../../domain-helpers.js";
import {
  useActiveCollectionSync,
  useCollectionItemsLoader,
  useCollectionSchemaLoader,
  useCollectionWorkspaceLoader,
  useCollectionsListLoader,
  useReferenceOptionsLoader
} from "../../useCollectionsLoaders.js";
import { buildModuleCollectionMap } from "../../domain-helpers.js";

function useModuleCollectionMapSyncEffect({
  api,
  enabled,
  isAuthenticated,
  moduleRuntimeItems,
  moduleRuntimeReloadToken,
  setModuleCollectionMap
}) {
  useEffect(() => {
    if (!enabled || !isAuthenticated) {
      return;
    }

    if (Array.isArray(moduleRuntimeItems)) {
      setModuleCollectionMap(buildModuleCollectionMap(moduleRuntimeItems));
      return;
    }

    if (typeof api.readModulesRuntime !== "function") {
      setModuleCollectionMap({});
      return;
    }

    let cancelled = false;

    api
      .readModulesRuntime()
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setModuleCollectionMap(buildModuleCollectionMap(payload?.runtime?.items));
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setModuleCollectionMap({});
      });

    return () => {
      cancelled = true;
    };
  }, [api, enabled, isAuthenticated, moduleRuntimeItems, moduleRuntimeReloadToken, setModuleCollectionMap]);
}

function useCollectionScopeSyncEffect({
  activeCollectionId,
  activeModuleId,
  collectionScopeKey,
  collectionScopeRef,
  isAuthenticated,
  isCollectionsRouteActive,
  moduleCollectionMap,
  scopedCollectionsItems,
  setActiveCollectionId,
  setCollectionFilterState,
  setCollectionFormState
}) {
  useEffect(() => {
    if (!isAuthenticated || !isCollectionsRouteActive) {
      return;
    }

    const previousScopeKey = collectionScopeRef.current;
    if (previousScopeKey === collectionScopeKey) {
      return;
    }
    collectionScopeRef.current = collectionScopeKey;
    const previousModuleId = previousScopeKey.split(":")[0] ?? "";
    const moduleChanged = previousModuleId !== activeModuleId;

    const preferredCollectionId = resolvePreferredActiveCollectionId({
      activeCollectionId: moduleChanged ? null : activeCollectionId,
      activeModuleId,
      scopedCollectionsItems,
      moduleCollectionMap
    });
    if (!preferredCollectionId) {
      if (moduleChanged && typeof activeModuleId === "string" && activeModuleId.length > 0) {
        setActiveCollectionId(activeModuleId);
        setCollectionFilterState(createDefaultCollectionFilterState(activeModuleId, null));
        setCollectionFormState(createDefaultCollectionFormState(activeModuleId, null));
      }
      return;
    }
    if (!moduleChanged && preferredCollectionId === activeCollectionId) {
      return;
    }

    setActiveCollectionId(preferredCollectionId);
    setCollectionFilterState(
      createDefaultCollectionFilterState(preferredCollectionId, null)
    );
    setCollectionFormState(createDefaultCollectionFormState(preferredCollectionId, null));
  }, [
    activeCollectionId,
    activeModuleId,
    collectionScopeKey,
    collectionScopeRef,
    isAuthenticated,
    isCollectionsRouteActive,
    moduleCollectionMap,
    scopedCollectionsItems,
    setActiveCollectionId,
    setCollectionFilterState,
    setCollectionFormState
  ]);
}

function useRouteCollectionSyncEffect({
  activeCollectionId,
  isAuthenticated,
  isCollectionsRouteActive,
  routeCollectionId,
  scopedCollectionsItems,
  setActiveCollectionId,
  setCollectionFilterState,
  setCollectionFormState
}) {
  useEffect(() => {
    if (!isAuthenticated || !isCollectionsRouteActive) {
      return;
    }

    const normalizedRouteCollectionId = routeCollectionId.trim();
    if (!normalizedRouteCollectionId) {
      return;
    }

    const routeCollectionExists = scopedCollectionsItems.some(
      (collection) => collection.id === normalizedRouteCollectionId
    );
    if (!routeCollectionExists || normalizedRouteCollectionId === activeCollectionId) {
      return;
    }

    setActiveCollectionId(normalizedRouteCollectionId);
    setCollectionFilterState(createDefaultCollectionFilterState(normalizedRouteCollectionId, null));
    setCollectionFormState(createDefaultCollectionFormState(normalizedRouteCollectionId, null));
  }, [
    activeCollectionId,
    isAuthenticated,
    isCollectionsRouteActive,
    routeCollectionId,
    scopedCollectionsItems,
    setActiveCollectionId,
    setCollectionFilterState,
    setCollectionFormState
  ]);
}

function useCollectionDomainResourceLoaders({
  enabled,
  api,
  activeCollectionId,
  activeCollectionUnavailableMessage,
  collectionFilterKey,
  collectionListOptions,
  collectionItemsReloadToken,
  isActiveCollectionAvailable,
  isCollectionsRouteActive,
  isAuthenticated,
  setCollectionSchemaState,
  setCollectionItemsState,
  setReferenceOptionsState,
  collectionSchemaState,
  collectionsState,
  collectionFilterState
}) {
  const useWorkspaceHydration =
    enabled && typeof api.readCollectionWorkspace === "function";

  useCollectionWorkspaceLoader({
    activeCollectionId,
    activeCollectionUnavailableMessage,
    api,
    collectionFilterKey,
    collectionListOptions,
    collectionItemsReloadToken,
    isActiveCollectionAvailable,
    isCollectionsRouteActive,
    isAuthenticated: isAuthenticated && enabled,
    setCollectionSchemaState,
    setCollectionItemsState,
    setReferenceOptionsState,
    enabled: useWorkspaceHydration
  });

  useCollectionSchemaLoader({
    activeCollectionId,
    activeCollectionUnavailableMessage,
    api,
    isActiveCollectionAvailable,
    isCollectionsRouteActive,
    isAuthenticated: isAuthenticated && enabled,
    setCollectionSchemaState,
    enabled: !useWorkspaceHydration
  });

  useReferenceOptionsLoader({
    activeCollectionId,
    activeCollectionSchema: collectionSchemaState.collection,
    api,
    collectionsItems: collectionsState.items,
    isCollectionsRouteActive,
    isAuthenticated: isAuthenticated && enabled,
    setReferenceOptionsState,
    enabled: !useWorkspaceHydration
  });

  useCollectionItemsLoader({
    activeCollectionId,
    activeCollectionSchema: collectionSchemaState.collection,
    activeCollectionUnavailableMessage,
    api,
    collectionFilterKey,
    collectionFilterState,
    collectionItemsReloadToken,
    isActiveCollectionAvailable,
    isCollectionsRouteActive,
    isAuthenticated: isAuthenticated && enabled,
    setCollectionItemsState,
    enabled: !useWorkspaceHydration
  });
}

function useCollectionsDomainLoadersAndScopeEffects({
  api,
  enabled,
  isAuthenticated,
  moduleRuntimeItems,
  moduleRuntimeReloadToken,
  collectionsState,
  setCollectionsState,
  setModuleCollectionMap,
  activeCollectionId,
  activeModuleId,
  collectionScopeKey,
  collectionScopeRef,
  isCollectionsRouteActive,
  moduleCollectionMap,
  scopedCollectionsItems,
  routeCollectionId,
  setActiveCollectionId,
  setCollectionFilterState,
  setCollectionFormState,
  activeCollectionUnavailableMessage,
  collectionListOptions,
  collectionFilterKey,
  collectionItemsReloadToken,
  isActiveCollectionAvailable,
  collectionSchemaState,
  collectionFilterState,
  setCollectionSchemaState,
  setCollectionItemsState,
  setReferenceOptionsState
}) {
  useCollectionsListLoader({
    api,
    isAuthenticated: isAuthenticated && enabled,
    moduleRuntimeReloadToken,
    setCollectionsState
  });

  useModuleCollectionMapSyncEffect({
    api,
    enabled,
    isAuthenticated,
    moduleRuntimeItems,
    moduleRuntimeReloadToken,
    setModuleCollectionMap
  });

  useActiveCollectionSync({
    activeCollectionId,
    collectionsItems: scopedCollectionsItems,
    isAuthenticated: isAuthenticated && enabled,
    setActiveCollectionId
  });

  useCollectionScopeSyncEffect({
    activeCollectionId,
    activeModuleId,
    collectionScopeKey,
    collectionScopeRef,
    isAuthenticated,
    isCollectionsRouteActive,
    moduleCollectionMap,
    scopedCollectionsItems,
    setActiveCollectionId,
    setCollectionFilterState,
    setCollectionFormState
  });

  useRouteCollectionSyncEffect({
    activeCollectionId,
    isAuthenticated,
    isCollectionsRouteActive,
    routeCollectionId,
    scopedCollectionsItems,
    setActiveCollectionId,
    setCollectionFilterState,
    setCollectionFormState
  });

  useCollectionDomainResourceLoaders({
    enabled,
    api,
    activeCollectionId,
    activeCollectionUnavailableMessage,
    collectionFilterKey,
    collectionListOptions,
    collectionItemsReloadToken,
    isActiveCollectionAvailable,
    isCollectionsRouteActive,
    isAuthenticated,
    setCollectionSchemaState,
    setCollectionItemsState,
    setReferenceOptionsState,
    collectionSchemaState,
    collectionsState,
    collectionFilterState
  });
}

export { useCollectionsDomainLoadersAndScopeEffects };
