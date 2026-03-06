import { useEffect } from "react";
import {
  COLLECTION_PAGE_LIMIT,
  buildCollectionListOptions,
  buildCollectionUnavailableMessage,
  resolveReferenceCollectionIds
} from "./domain-helpers.js";
import {
  createDefaultCollectionItemsState,
  createDefaultCollectionOptionsState
} from "./state-helpers.js";

function buildWorkspaceReferenceOptionsState(workspaceReferenceOptions = {}) {
  const nextState = {};
  for (const [collectionId, entry] of Object.entries(workspaceReferenceOptions ?? {})) {
    if (typeof collectionId !== "string" || collectionId.length === 0) {
      continue;
    }

    nextState[collectionId] = {
      loading: false,
      errorMessage:
        typeof entry?.errorMessage === "string" && entry.errorMessage.length > 0
          ? entry.errorMessage
          : null,
      items: Array.isArray(entry?.items) ? entry.items : []
    };
  }

  return nextState;
}

function setCollectionWorkspaceLoadFailureState({
  errorMessage,
  setCollectionSchemaState,
  setCollectionItemsState,
  setReferenceOptionsState
}) {
  setCollectionSchemaState({
    loading: false,
    errorMessage,
    collection: null
  });
  setCollectionItemsState({
    ...createDefaultCollectionItemsState(),
    errorMessage
  });
  setReferenceOptionsState({});
}

function setCollectionWorkspaceLoadSuccessState({
  payload,
  setCollectionSchemaState,
  setCollectionItemsState,
  setReferenceOptionsState
}) {
  setCollectionSchemaState({
    loading: false,
    errorMessage: null,
    collection: payload?.collection ?? null
  });
  setCollectionItemsState({
    loading: false,
    errorMessage: null,
    items: payload?.items ?? [],
    meta: {
      total: payload?.meta?.total ?? 0,
      offset: payload?.meta?.offset ?? 0,
      limit: payload?.meta?.limit ?? COLLECTION_PAGE_LIMIT
    }
  });
  setReferenceOptionsState(buildWorkspaceReferenceOptionsState(payload?.referenceOptions));
}

function buildReferenceOptionsFailureEntry(referenceCollectionId, errorMessage) {
  return {
    loading: false,
    errorMessage:
      errorMessage ?? `Failed to load '${referenceCollectionId}' options`,
    items: []
  };
}

function buildReferenceOptionsEntryFromPayload(payload, referenceCollectionId) {
  if (payload?.ok) {
    return {
      loading: false,
      errorMessage: null,
      items: payload?.items ?? []
    };
  }

  return buildReferenceOptionsFailureEntry(
    referenceCollectionId,
    payload?.error?.message
  );
}

function setReferenceOptionsEntry(
  setReferenceOptionsState,
  referenceCollectionId,
  entry
) {
  setReferenceOptionsState((previous) => ({
    ...previous,
    [referenceCollectionId]: entry
  }));
}

function buildReferenceOptionsLoadingState({
  previous,
  referenceCollectionIds,
  activeCollectionIdSet
}) {
  const next = { ...previous };
  for (const referenceCollectionId of referenceCollectionIds) {
    if (!activeCollectionIdSet.has(referenceCollectionId)) {
      next[referenceCollectionId] = {
        loading: false,
        errorMessage: buildCollectionUnavailableMessage(referenceCollectionId),
        items: []
      };
      continue;
    }

    next[referenceCollectionId] = {
      ...(previous[referenceCollectionId] ?? createDefaultCollectionOptionsState()),
      loading: true,
      errorMessage: null
    };
  }

  return next;
}

async function loadReferenceOptionsForCollection({
  activeCollectionIdSet,
  api,
  isCancelled,
  referenceCollectionId,
  setReferenceOptionsState
}) {
  if (!activeCollectionIdSet.has(referenceCollectionId)) {
    return;
  }

  try {
    const payload = await api.listCollectionItems({
      collectionId: referenceCollectionId,
      offset: 0,
      limit: 200,
      search: ""
    });
    if (isCancelled()) {
      return;
    }
    setReferenceOptionsEntry(
      setReferenceOptionsState,
      referenceCollectionId,
      buildReferenceOptionsEntryFromPayload(payload, referenceCollectionId)
    );
  } catch (error) {
    if (isCancelled()) {
      return;
    }
    setReferenceOptionsEntry(
      setReferenceOptionsState,
      referenceCollectionId,
      buildReferenceOptionsFailureEntry(referenceCollectionId, error?.message)
    );
  }
}

function useCollectionsListLoader({
  api,
  isAuthenticated,
  moduleRuntimeReloadToken,
  setCollectionsState
}) {
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let cancelled = false;
    setCollectionsState((previous) => ({
      ...previous,
      loading: true,
      errorMessage: null
    }));

    api
      .listCollections()
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setCollectionsState({
          loading: false,
          errorMessage: null,
          items: payload?.items ?? []
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setCollectionsState({
          loading: false,
          errorMessage: error?.message ?? "Failed to load collections",
          items: []
        });
      });

    return () => {
      cancelled = true;
    };
  }, [api, isAuthenticated, moduleRuntimeReloadToken, setCollectionsState]);
}

function useActiveCollectionSync({
  activeCollectionId,
  collectionsItems,
  isAuthenticated,
  setActiveCollectionId
}) {
  useEffect(() => {
    if (!isAuthenticated || collectionsItems.length === 0) {
      return;
    }

    const exists = collectionsItems.some((collection) => collection.id === activeCollectionId);
    if (exists) {
      return;
    }

    const fallback = collectionsItems[0];
    if (!fallback || typeof fallback.id !== "string" || fallback.id.length === 0) {
      return;
    }
    setActiveCollectionId(fallback.id);
  }, [activeCollectionId, collectionsItems, isAuthenticated, setActiveCollectionId]);
}

function useCollectionSchemaLoader({
  activeCollectionId,
  activeCollectionUnavailableMessage,
  api,
  enabled = true,
  isActiveCollectionAvailable,
  isCollectionsRouteActive,
  isAuthenticated,
  setCollectionSchemaState
}) {
  useEffect(() => {
    if (!enabled || !isAuthenticated || !isCollectionsRouteActive) {
      return;
    }

    if (!isActiveCollectionAvailable) {
      setCollectionSchemaState({
        loading: false,
        errorMessage: activeCollectionUnavailableMessage,
        collection: null
      });
      return;
    }

    let cancelled = false;
    setCollectionSchemaState((previous) => ({
      ...previous,
      loading: true,
      errorMessage: null
    }));

    api
      .readCollectionSchema({
        collectionId: activeCollectionId
      })
      .then((payload) => {
        if (cancelled) {
          return;
        }

        if (!payload?.ok) {
          setCollectionSchemaState({
            loading: false,
            errorMessage: payload?.error?.message ?? "Failed to load collection schema",
            collection: null
          });
          return;
        }

        setCollectionSchemaState({
          loading: false,
          errorMessage: null,
          collection: payload?.collection ?? null
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setCollectionSchemaState({
          loading: false,
          errorMessage: error?.message ?? "Failed to load collection schema",
          collection: null
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeCollectionId,
    activeCollectionUnavailableMessage,
    api,
    enabled,
    isActiveCollectionAvailable,
    isCollectionsRouteActive,
    isAuthenticated,
    setCollectionSchemaState
  ]);
}

function useCollectionWorkspaceLoader({
  activeCollectionId,
  activeCollectionUnavailableMessage,
  api,
  collectionFilterKey,
  collectionListOptions,
  collectionItemsReloadToken,
  enabled = true,
  isActiveCollectionAvailable,
  isCollectionsRouteActive,
  isAuthenticated,
  setCollectionSchemaState,
  setCollectionItemsState,
  setReferenceOptionsState
}) {
  useEffect(() => {
    if (
      !enabled ||
      !isAuthenticated ||
      !isCollectionsRouteActive ||
      typeof api.readCollectionWorkspace !== "function"
    ) {
      return;
    }

    if (!isActiveCollectionAvailable) {
      setCollectionSchemaState({
        loading: false,
        errorMessage: activeCollectionUnavailableMessage,
        collection: null
      });
      setCollectionItemsState({
        ...createDefaultCollectionItemsState(),
        errorMessage: activeCollectionUnavailableMessage
      });
      setReferenceOptionsState({});
      return;
    }

    let cancelled = false;

    setCollectionSchemaState((previous) => ({
      ...previous,
      loading: true,
      errorMessage: null
    }));
    setCollectionItemsState((previous) => ({
      ...previous,
      loading: true,
      errorMessage: null
    }));

    api
      .readCollectionWorkspace(collectionListOptions)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        if (!payload?.ok) {
          setCollectionWorkspaceLoadFailureState({
            errorMessage:
              payload?.error?.message ?? "Failed to load collection workspace",
            setCollectionSchemaState,
            setCollectionItemsState,
            setReferenceOptionsState
          });
          return;
        }

        setCollectionWorkspaceLoadSuccessState({
          payload,
          setCollectionSchemaState,
          setCollectionItemsState,
          setReferenceOptionsState
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setCollectionWorkspaceLoadFailureState({
          errorMessage: error?.message ?? "Failed to load collection workspace",
          setCollectionSchemaState,
          setCollectionItemsState,
          setReferenceOptionsState
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeCollectionId,
    activeCollectionUnavailableMessage,
    api,
    collectionFilterKey,
    collectionListOptions,
    collectionItemsReloadToken,
    enabled,
    isActiveCollectionAvailable,
    isAuthenticated,
    isCollectionsRouteActive,
    setCollectionItemsState,
    setCollectionSchemaState,
    setReferenceOptionsState
  ]);
}

function useReferenceOptionsLoader({
  activeCollectionId,
  activeCollectionSchema,
  api,
  collectionsItems,
  enabled = true,
  isCollectionsRouteActive,
  isAuthenticated,
  setReferenceOptionsState
}) {
  useEffect(() => {
    if (!enabled || !isAuthenticated || !isCollectionsRouteActive) {
      return;
    }

    const referenceCollectionIds = resolveReferenceCollectionIds(
      activeCollectionSchema,
      activeCollectionId
    );
    if (referenceCollectionIds.length === 0) {
      return;
    }

    const activeCollectionIdSet = new Set(collectionsItems.map((item) => item.id));
    let cancelled = false;

    setReferenceOptionsState((previous) =>
      buildReferenceOptionsLoadingState({
        previous,
        referenceCollectionIds,
        activeCollectionIdSet
      })
    );

    const loadPromises = referenceCollectionIds.map((referenceCollectionId) =>
      loadReferenceOptionsForCollection({
        activeCollectionIdSet,
        api,
        isCancelled: () => cancelled,
        referenceCollectionId,
        setReferenceOptionsState
      })
    );

    Promise.all(loadPromises).catch(() => {
      // Errors are handled per-load to preserve deterministic state updates.
    });

    return () => {
      cancelled = true;
    };
  }, [
    activeCollectionId,
    activeCollectionSchema,
    api,
    collectionsItems,
    enabled,
    isCollectionsRouteActive,
    isAuthenticated,
    setReferenceOptionsState
  ]);
}

function useCollectionItemsLoader({
  activeCollectionId,
  activeCollectionSchema,
  activeCollectionUnavailableMessage,
  api,
  collectionFilterKey,
  collectionFilterState,
  collectionItemsReloadToken,
  enabled = true,
  isActiveCollectionAvailable,
  isCollectionsRouteActive,
  isAuthenticated,
  setCollectionItemsState
}) {
  useEffect(() => {
    if (!enabled || !isAuthenticated || !isCollectionsRouteActive) {
      return;
    }

    if (!isActiveCollectionAvailable) {
      setCollectionItemsState({
        ...createDefaultCollectionItemsState(),
        errorMessage: activeCollectionUnavailableMessage
      });
      return;
    }

    let cancelled = false;

    setCollectionItemsState((previous) => ({
      ...previous,
      loading: true,
      errorMessage: null
    }));

    const listOptions = buildCollectionListOptions(
      activeCollectionId,
      collectionFilterState,
      activeCollectionSchema
    );

    api
      .listCollectionItems(listOptions)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        if (!payload?.ok) {
          setCollectionItemsState({
            loading: false,
            errorMessage: payload?.error?.message ?? "Failed to load collection items",
            items: [],
            meta: {
              total: 0,
              offset: 0,
              limit: COLLECTION_PAGE_LIMIT
            }
          });
          return;
        }

        setCollectionItemsState({
          loading: false,
          errorMessage: null,
          items: payload?.items ?? [],
          meta: {
            total: payload?.meta?.total ?? 0,
            offset: payload?.meta?.offset ?? 0,
            limit: payload?.meta?.limit ?? COLLECTION_PAGE_LIMIT
          }
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setCollectionItemsState({
          loading: false,
          errorMessage: error?.message ?? "Failed to load collection items",
          items: [],
          meta: {
            total: 0,
            offset: 0,
            limit: COLLECTION_PAGE_LIMIT
          }
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeCollectionId,
    activeCollectionSchema,
    activeCollectionUnavailableMessage,
    api,
    collectionFilterKey,
    collectionFilterState,
    collectionItemsReloadToken,
    enabled,
    isActiveCollectionAvailable,
    isCollectionsRouteActive,
    isAuthenticated,
    setCollectionItemsState
  ]);
}

export {
  useActiveCollectionSync,
  useCollectionItemsLoader,
  useCollectionSchemaLoader,
  useCollectionWorkspaceLoader,
  useCollectionsListLoader,
  useReferenceOptionsLoader
};
