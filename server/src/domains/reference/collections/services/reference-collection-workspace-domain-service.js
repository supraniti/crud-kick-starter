import {
  resolveReferenceOptionsProviderLifecycleGate,
  resolveReferenceOptionsProviderRegistration
} from "../../runtime/services/reference-options-provider-policy-runtime-domain-service.js";
import {
  WORKSPACE_REFERENCE_OPTIONS_LIMIT,
  collectionNotFoundPayload,
  isReferenceField
} from "./reference-collection-route-shared-domain-service.js";

function resolveCollectionAccess({
  collectionId,
  resolveActiveCollectionResolution,
  collectionHandlerRegistry
}) {
  const activeCollections = resolveActiveCollectionResolution();
  const definition = activeCollections.definitions?.[collectionId] ?? null;
  const handler = collectionHandlerRegistry.get(collectionId);
  if (!definition || !handler) {
    return {
      ok: false,
      payload: collectionNotFoundPayload(collectionId)
    };
  }

  return {
    ok: true,
    activeCollections,
    definition,
    moduleId: activeCollections.collectionModuleMap?.[collectionId] ?? null,
    handler
  };
}

function resolveReferenceCollectionIds(definition) {
  const referenceCollectionIds = [];

  for (const field of definition?.fields ?? []) {
    if (!isReferenceField(field)) {
      continue;
    }

    const collectionId =
      typeof field?.collectionId === "string" ? field.collectionId : "";
    if (!collectionId || referenceCollectionIds.includes(collectionId)) {
      continue;
    }

    referenceCollectionIds.push(collectionId);
  }

  return referenceCollectionIds;
}

function createWorkspaceReferenceOptionsEntry({ items = [], errorMessage = null } = {}) {
  return {
    items: Array.isArray(items) ? items : [],
    errorMessage:
      typeof errorMessage === "string" && errorMessage.length > 0 ? errorMessage : null
  };
}

function buildWorkspacePayload({
  collectionId,
  definition,
  listPayload,
  referenceOptions
}) {
  return {
    ok: true,
    collectionId,
    collection: definition,
    items: listPayload?.items ?? [],
    meta: listPayload?.meta ?? {
      total: 0,
      offset: 0,
      limit: 25
    },
    filters: listPayload?.filters ?? {},
    referenceOptions,
    timestamp: new Date().toISOString()
  };
}

function referenceOptionsLoadErrorMessage(referenceCollectionId, error) {
  return error?.message ?? `Failed to load '${referenceCollectionId}' options`;
}

function setWorkspaceReferenceOptionsItems(referenceOptions, referenceCollectionId, items) {
  referenceOptions[referenceCollectionId] = createWorkspaceReferenceOptionsEntry({
    items: items ?? []
  });
}

function setWorkspaceReferenceOptionsError(referenceOptions, referenceCollectionId, errorMessage) {
  referenceOptions[referenceCollectionId] = createWorkspaceReferenceOptionsEntry({
    errorMessage
  });
}

function resolveReferenceCollectionContext({
  activeCollections,
  collectionHandlerRegistry,
  referenceCollectionId,
  referenceOptionsProviderRegistry
}) {
  const referenceDefinition = activeCollections?.definitions?.[referenceCollectionId] ?? null;
  const referenceHandler = collectionHandlerRegistry.get(referenceCollectionId);
  const providerRegistration = resolveReferenceOptionsProviderRegistration(
    referenceOptionsProviderRegistry,
    referenceCollectionId
  );

  return {
    referenceDefinition,
    referenceHandler,
    providerRegistration,
    referenceOptionsProvider: providerRegistration?.provider ?? null
  };
}

function createProviderLifecycleUnavailableMessage(referenceCollectionId, lifecycleGate) {
  const moduleStateToken =
    typeof lifecycleGate.moduleState === "string" && lifecycleGate.moduleState.length > 0
      ? lifecycleGate.moduleState
      : "unavailable";

  return `Reference options provider for '${referenceCollectionId}' is unavailable because module '${lifecycleGate.moduleId}' is '${moduleStateToken}'`;
}

async function loadWorkspaceReferenceOptionsFromProvider({
  activeCollections,
  state,
  referenceCollectionId,
  providerRegistration,
  referenceOptionsProvider,
  moduleRegistry,
  referenceOptionsProviderPolicy,
  referenceOptions
}) {
  const lifecycleGate = resolveReferenceOptionsProviderLifecycleGate({
    providerRegistration,
    moduleRegistry,
    referenceOptionsProviderPolicy
  });
  if (!lifecycleGate.ok) {
    setWorkspaceReferenceOptionsError(
      referenceOptions,
      referenceCollectionId,
      createProviderLifecycleUnavailableMessage(referenceCollectionId, lifecycleGate)
    );
    return;
  }

  try {
    const payload = await referenceOptionsProvider.listOptions({
      referenceCollectionId,
      activeCollections,
      state,
      moduleRegistry,
      providerModuleId: providerRegistration?.moduleId ?? null,
      providerPolicy: lifecycleGate.policy,
      limit: WORKSPACE_REFERENCE_OPTIONS_LIMIT,
      query: ""
    });
    setWorkspaceReferenceOptionsItems(referenceOptions, referenceCollectionId, payload?.items);
  } catch (error) {
    setWorkspaceReferenceOptionsError(
      referenceOptions,
      referenceCollectionId,
      referenceOptionsLoadErrorMessage(referenceCollectionId, error)
    );
  }
}

async function loadWorkspaceReferenceOptionsFromCollectionHandler({
  referenceCollectionId,
  referenceHandler,
  referenceOptions
}) {
  try {
    const payload = await referenceHandler.list({
      offset: 0,
      limit: WORKSPACE_REFERENCE_OPTIONS_LIMIT,
      search: ""
    });
    setWorkspaceReferenceOptionsItems(referenceOptions, referenceCollectionId, payload?.items);
  } catch (error) {
    setWorkspaceReferenceOptionsError(
      referenceOptions,
      referenceCollectionId,
      referenceOptionsLoadErrorMessage(referenceCollectionId, error)
    );
  }
}

async function loadWorkspaceReferenceOptionsForCollection({
  activeCollections,
  state,
  collectionHandlerRegistry,
  referenceOptionsProviderRegistry,
  moduleRegistry,
  referenceOptionsProviderPolicy,
  referenceCollectionId,
  referenceOptions
}) {
  const {
    referenceDefinition,
    referenceHandler,
    providerRegistration,
    referenceOptionsProvider
  } = resolveReferenceCollectionContext({
    activeCollections,
    collectionHandlerRegistry,
    referenceCollectionId,
    referenceOptionsProviderRegistry
  });

  if (!referenceDefinition || !referenceHandler) {
    if (typeof referenceOptionsProvider?.listOptions === "function") {
      await loadWorkspaceReferenceOptionsFromProvider({
        activeCollections,
        state,
        referenceCollectionId,
        providerRegistration,
        referenceOptionsProvider,
        moduleRegistry,
        referenceOptionsProviderPolicy,
        referenceOptions
      });
      return;
    }

    setWorkspaceReferenceOptionsError(
      referenceOptions,
      referenceCollectionId,
      `Collection '${referenceCollectionId}' was not found`
    );
    return;
  }

  await loadWorkspaceReferenceOptionsFromCollectionHandler({
    referenceCollectionId,
    referenceHandler,
    referenceOptions
  });
}

async function resolveWorkspaceReferenceOptions({
  activeCollections,
  state,
  definition,
  collectionHandlerRegistry,
  referenceOptionsProviderRegistry,
  moduleRegistry,
  referenceOptionsProviderPolicy
}) {
  const referenceOptions = {};
  const referenceCollectionIds = resolveReferenceCollectionIds(definition);
  if (referenceCollectionIds.length === 0) {
    return referenceOptions;
  }

  await Promise.all(
    referenceCollectionIds.map((referenceCollectionId) =>
      loadWorkspaceReferenceOptionsForCollection({
        activeCollections,
        state,
        collectionHandlerRegistry,
        referenceOptionsProviderRegistry,
        moduleRegistry,
        referenceOptionsProviderPolicy,
        referenceCollectionId,
        referenceOptions
      })
    )
  );

  return referenceOptions;
}

export {
  buildWorkspacePayload,
  resolveCollectionAccess,
  resolveWorkspaceReferenceOptions
};

